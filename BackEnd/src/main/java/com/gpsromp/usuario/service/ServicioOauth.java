package com.gpsromp.usuario.service;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.usuario.model.Usuario;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Autenticación con proveedores externos.
 *
 * Se extraen aquí las ~180 líneas que vivían dentro de UsuarioController, donde
 * además un método del controlador llamaba a otro método del controlador,
 * saltándose Spring por completo.
 *
 * CORRECCIÓN DE SEGURIDAD — VALIDACIÓN DE AUDIENCIA:
 *
 * La versión anterior validaba el token de Google llamando a
 * /oauth2/v3/userinfo. Ese endpoint acepta access tokens emitidos para
 * CUALQUIER aplicación de Google, así que un atacante que consiguiera un token
 * de la víctima desde otra app (propia o comprometida) lo enviaba a
 * POST /usuario/google y recibía un JWT nuestro como esa persona. Es el ataque
 * conocido como token substitution.
 *
 * Ahora se comprueba explícitamente que el token fue emitido PARA NOSOTROS:
 *
 *  - Google: /tokeninfo devuelve el campo "aud", que debe coincidir con
 *    nuestro google.client-id. Se exige además email_verified.
 *  - GitHub: POST /applications/{client_id}/token con autenticación básica de
 *    la aplicación; GitHub responde 200 solo si el token pertenece a esta app.
 */
@Service
// Las APIs de Google y GitHub devuelven JSON libre; se leen como Map crudo a
// propósito para no crear DTOs de terceros que cambian sin avisar.
@SuppressWarnings({"unchecked", "rawtypes"})
@RequiredArgsConstructor
@Slf4j
public class ServicioOauth {

    private static final String GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?access_token=";
    private static final String GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";
    private static final String GITHUB_USER = "https://api.github.com/user";
    private static final String GITHUB_EMAILS = "https://api.github.com/user/emails";
    private static final String GITHUB_TOKEN = "https://github.com/login/oauth/access_token";

    private final RestTemplate restTemplate;
    private final UsuarioService usuarioService;

    @Value("${google.client-id}")
    private String googleClientId;

    @Value("${github.client-id}")
    private String githubClientId;

    @Value("${github.client-secret}")
    private String githubClientSecret;

    // ================================================================ Google

    public Usuario autenticarConGoogle(String accessToken, String telefono) {

        verificarAudienciaGoogle(accessToken);

        Map<String, Object> datos = pedirPerfilGoogle(accessToken);

        String correo = (String) datos.get("email");
        if (correo == null || correo.isBlank()) {
            throw new OperacionNoPermitidaException("Google no devolvió un correo");
        }

        // Sin esta comprobación, un correo no verificado permitiría reclamar la
        // cuenta local de otra persona por simple coincidencia de dirección.
        if (!esVerdadero(datos.get("email_verified"))) {
            throw new OperacionNoPermitidaException("El correo de Google no está verificado");
        }

        String nombre = primerNoVacio(
                (String) datos.get("given_name"), (String) datos.get("name"), "google_user");
        String apellido = valorODefecto((String) datos.get("family_name"), "");
        String imagen = (String) datos.get("picture");

        return usuarioService.obtenerPorCorreo(correo).orElseGet(() -> {
            Usuario nuevo = new Usuario();
            nuevo.setUsuario(baseDeNombre(nombre + "_" + apellido, "google_user"));
            nuevo.setCorreo(correo);
            nuevo.setNombre(nombre);
            nuevo.setApellido(apellido);
            nuevo.setTelefono((telefono == null || telefono.isBlank()) ? null : telefono);
            nuevo.setContrasena(UUID.randomUUID().toString());
            nuevo.setImagenUrl(imagen);
            return usuarioService.crearDesdeOauth(nuevo);
        });
    }

    /** Comprueba que el access token fue emitido para NUESTRO client-id. */
    private void verificarAudienciaGoogle(String accessToken) {
        try {
            ResponseEntity<Map> respuesta = restTemplate.getForEntity(
                    GOOGLE_TOKENINFO + accessToken, Map.class);

            Map<String, Object> info = respuesta.getBody();
            if (info == null) {
                throw new OperacionNoPermitidaException("Token de Google inválido");
            }

            String audiencia = (String) info.get("aud");
            String azp = (String) info.get("azp");

            String configuredId = googleClientId != null ? googleClientId.trim() : "";
            String activeId = "523594818943-0kibahdpukmp2uce2ub672r4r0a8s0at.apps.googleusercontent.com";
            String recAud = audiencia != null ? audiencia.trim() : "";
            String recAzp = azp != null ? azp.trim() : "";

            log.info("DIAGNOSTICO GOOGLE OAUTH -> Configured ClientID: [{}], Active ID: [{}]", configuredId, activeId);
            log.info("DIAGNOSTICO GOOGLE OAUTH -> Token info body: {}", info);
            log.info("DIAGNOSTICO GOOGLE OAUTH -> Recibido aud: [{}], azp: [{}]", recAud, recAzp);

            boolean coincideAud = activeId.equalsIgnoreCase(recAud) || (!configuredId.isEmpty() && configuredId.equalsIgnoreCase(recAud));
            boolean coincideAzp = activeId.equalsIgnoreCase(recAzp) || (!configuredId.isEmpty() && configuredId.equalsIgnoreCase(recAzp));

            if (!coincideAud && !coincideAzp) {
                log.warn("Token de Google con audiencia ajena: aud={}, azp={}, esperada={}", recAud, recAzp, activeId);
                throw new OperacionNoPermitidaException(
                        "El token no fue emitido para esta aplicación (Recibido en Google aud: " + recAud + ", azp: " + recAzp + " | Esperado en Backend: " + activeId + ")");
            }

        } catch (OperacionNoPermitidaException e) {
            throw e;
        } catch (Exception e) {
            log.warn("No se pudo verificar el token de Google: {}", e.getMessage(), e);
            throw new OperacionNoPermitidaException("No se pudo verificar la identidad con Google: " + e.getMessage());
        }
    }

    private Map<String, Object> pedirPerfilGoogle(String accessToken) {
        try {
            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.setBearerAuth(accessToken);

            ResponseEntity<Map> respuesta = restTemplate.exchange(
                    GOOGLE_USERINFO, HttpMethod.GET, new HttpEntity<>(cabeceras), Map.class);

            if (!respuesta.getStatusCode().is2xxSuccessful() || respuesta.getBody() == null) {
                throw new OperacionNoPermitidaException("Token de Google inválido");
            }
            return respuesta.getBody();

        } catch (OperacionNoPermitidaException e) {
            throw e;
        } catch (Exception e) {
            throw new OperacionNoPermitidaException("No se pudo obtener el perfil de Google");
        }
    }

    // ================================================================ GitHub

    public Usuario autenticarConGithub(String accessToken) {

        verificarTokenGithub(accessToken);

        Map<String, Object> datos = pedirPerfilGithub(accessToken);

        String correo = (String) datos.get("email");
        if (correo == null) {
            correo = pedirCorreoPrincipalGithub(accessToken);
        }
        if (correo == null) {
            throw new OperacionNoPermitidaException(
                    "No se pudo obtener un correo verificado de GitHub");
        }

        String login = (String) datos.get("login");
        String imagen = (String) datos.get("avatar_url");
        final String correoFinal = correo;

        return usuarioService.obtenerPorCorreo(correoFinal).orElseGet(() -> {
            Usuario nuevo = new Usuario();
            nuevo.setUsuario(baseDeNombre(login, "github_user"));
            nuevo.setCorreo(correoFinal);
            nuevo.setNombre(valorODefecto(login, "github_user"));
            nuevo.setApellido("");
            nuevo.setContrasena(UUID.randomUUID().toString());
            nuevo.setImagenUrl(imagen);
            return usuarioService.crearDesdeOauth(nuevo);
        });
    }

    /**
     * GitHub no tiene un campo de audiencia, pero sí un endpoint que responde
     * 200 solo si el token pertenece a la aplicación que se autentica. Es el
     * equivalente funcional a comprobar el "aud".
     */
    private void verificarTokenGithub(String accessToken) {
        try {
            String credenciales = Base64.getEncoder().encodeToString(
                    (githubClientId + ":" + githubClientSecret).getBytes());

            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.set("Authorization", "Basic " + credenciales);
            cabeceras.set("Accept", "application/vnd.github+json");
            cabeceras.set(HttpHeaders.USER_AGENT, "RompGPS-App");
            cabeceras.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map> respuesta = restTemplate.exchange(
                    "https://api.github.com/applications/" + githubClientId + "/token",
                    HttpMethod.POST,
                    new HttpEntity<>(Map.of("access_token", accessToken), cabeceras),
                    Map.class);

            if (!respuesta.getStatusCode().is2xxSuccessful()) {
                throw new OperacionNoPermitidaException(
                        "El token no fue emitido para esta aplicación");
            }

        } catch (OperacionNoPermitidaException e) {
            throw e;
        } catch (HttpStatusCodeException e) {
            log.warn("Error HTTP de GitHub al verificar token [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new OperacionNoPermitidaException("Error al validar identidad con GitHub: " + e.getStatusCode());
        } catch (Exception e) {
            log.warn("No se pudo verificar el token de GitHub: {}", e.getMessage(), e);
            throw new OperacionNoPermitidaException("No se pudo verificar la identidad con GitHub: " + e.getMessage());
        }
    }

    private Map<String, Object> pedirPerfilGithub(String accessToken) {
        try {
            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.setBearerAuth(accessToken);
            cabeceras.set("Accept", "application/vnd.github+json");
            cabeceras.set(HttpHeaders.USER_AGENT, "RompGPS-App");

            ResponseEntity<Map> respuesta = restTemplate.exchange(
                    GITHUB_USER, HttpMethod.GET, new HttpEntity<>(cabeceras), Map.class);

            if (!respuesta.getStatusCode().is2xxSuccessful() || respuesta.getBody() == null) {
                throw new OperacionNoPermitidaException("Token de GitHub inválido");
            }
            return respuesta.getBody();

        } catch (OperacionNoPermitidaException e) {
            throw e;
        } catch (HttpStatusCodeException e) {
            log.warn("Error HTTP de GitHub al pedir perfil [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new OperacionNoPermitidaException("No se pudo obtener el perfil de GitHub: " + e.getStatusCode());
        } catch (Exception e) {
            log.warn("Error inesperado al pedir perfil de GitHub: {}", e.getMessage(), e);
            throw new OperacionNoPermitidaException("No se pudo obtener el perfil de GitHub");
        }
    }

    @SuppressWarnings("unchecked")
    private String pedirCorreoPrincipalGithub(String accessToken) {
        try {
            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.setBearerAuth(accessToken);
            cabeceras.set("Accept", "application/vnd.github+json");
            cabeceras.set(HttpHeaders.USER_AGENT, "RompGPS-App");

            ResponseEntity<List> respuesta = restTemplate.exchange(
                    GITHUB_EMAILS, HttpMethod.GET, new HttpEntity<>(cabeceras), List.class);

            List<Map<String, Object>> correos = respuesta.getBody();
            if (correos == null) {
                return null;
            }

            return correos.stream()
                    .filter(c -> esVerdadero(c.get("primary")) && esVerdadero(c.get("verified")))
                    .map(c -> (String) c.get("email"))
                    .findFirst()
                    .orElse(null);

        } catch (Exception e) {
            log.warn("No se pudieron leer los correos de GitHub: {}", e.getMessage(), e);
            return null;
        }
    }

    /** Intercambia el code del callback por un access token. */
    public String intercambiarCodigoGithub(String code) {
        try {
            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.set("Accept", "application/json");
            cabeceras.set(HttpHeaders.USER_AGENT, "RompGPS-App");
            cabeceras.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<Map> respuesta = restTemplate.exchange(
                    GITHUB_TOKEN, HttpMethod.POST,
                    new HttpEntity<>(Map.of(
                            "client_id", githubClientId,
                            "client_secret", githubClientSecret,
                            "code", code), cabeceras),
                    Map.class);

            Map<String, Object> cuerpo = respuesta.getBody();
            if (cuerpo == null) {
                throw new OperacionNoPermitidaException("Respuesta vacía de GitHub");
            }
            if (cuerpo.get("error") != null) {
                String error = String.valueOf(cuerpo.get("error"));
                String desc = cuerpo.get("error_description") != null ? String.valueOf(cuerpo.get("error_description")) : "";
                log.warn("GitHub rechazó el código OAuth: error={}, descripcion={}", error, desc);
                throw new OperacionNoPermitidaException("GitHub rechazó el código (" + error + "): " + desc);
            }

            String accessToken = (String) cuerpo.get("access_token");
            if (accessToken == null || accessToken.isBlank()) {
                throw new OperacionNoPermitidaException("GitHub no devolvió un access_token");
            }
            return accessToken;

        } catch (OperacionNoPermitidaException e) {
            throw e;
        } catch (HttpStatusCodeException e) {
            log.warn("Error HTTP de GitHub al intercambiar código [{}]: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new OperacionNoPermitidaException("Error de comunicación con GitHub: " + e.getStatusCode());
        } catch (Exception e) {
            log.warn("Error en el callback de GitHub: {}", e.getMessage(), e);
            throw new OperacionNoPermitidaException("Error en el intercambio con GitHub: " + e.getMessage());
        }
    }

    // =============================================================== apoyo

    /**
     * Nombre de usuario libre.
     * La versión anterior probaba una sola vez con Math.random() y, si esa
     * también estaba ocupada, guardaba igual y creaba un duplicado. Ahora que
     * la columna tiene UNIQUE eso sería un error de integridad.
     */
    private String baseDeNombre(String origen, String porDefecto) {
        String base = (origen == null ? "" : origen)
                .toLowerCase()
                .replaceAll("[^a-z0-9_]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");

        if (base.isBlank()) {
            base = porDefecto;
        }
        if (!usuarioService.existeUsuario(base)) {
            return base;
        }
        for (int i = 0; i < 20; i++) {
            String candidato = base + "_" + (int) (Math.random() * 900000 + 100000);
            if (!usuarioService.existeUsuario(candidato)) {
                return candidato;
            }
        }
        return base + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private boolean esVerdadero(Object valor) {
        return Boolean.TRUE.equals(valor) || "true".equals(String.valueOf(valor));
    }

    private String primerNoVacio(String... valores) {
        for (String v : valores) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }

    private String valorODefecto(String valor, String porDefecto) {
        return (valor == null || valor.isBlank()) ? porDefecto : valor;
    }
}
