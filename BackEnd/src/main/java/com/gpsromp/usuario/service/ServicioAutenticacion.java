package com.gpsromp.usuario.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import com.gpsromp.config.JwtUtil;
import com.gpsromp.config.ServicioLimiteIntentos;
import com.gpsromp.config.ServicioTokens;
import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.model.Usuario;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Emisión de sesiones y control de intentos.
 *
 * Centraliza lo que antes estaba repetido en los cuatro flujos de login del
 * controlador, cada uno construyendo su propio Map de respuesta a mano.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ServicioAutenticacion {

    private final AuthenticationManager authenticationManager;
    private final UsuarioService usuarioService;
    private final JwtUtil jwtUtil;
    private final ServicioTokens servicioTokens;
    private final ServicioLimiteIntentos limiteIntentos;

    /**
     * Login con usuario y contraseña.
     *
     * @param identificadorCliente IP de quien llama, para el límite de intentos
     */
    public SesionResponse login(String nombreUsuario, String contrasena, String identificadorCliente) {

        // Dos contadores independientes: por IP y por cuenta. Así un atacante
        // externo no puede bloquear la cuenta de otra persona solo con fallar.
        String claveIp = "ip:" + identificadorCliente;
        String claveUsuario = "user:" + nombreUsuario;

        verificarNoBloqueado(claveIp);
        verificarNoBloqueado(claveUsuario);

        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(nombreUsuario, contrasena));

        } catch (BadCredentialsException e) {
            limiteIntentos.registrarFallo(claveIp);
            limiteIntentos.registrarFallo(claveUsuario);
            log.info("Login fallido para '{}' desde {}", nombreUsuario, identificadorCliente);
            throw new BadCredentialsException("Credenciales inválidas");
        }

        limiteIntentos.registrarExito(claveIp);
        limiteIntentos.registrarExito(claveUsuario);

        Usuario usuario = usuarioService.obtenerPorNombreUsuarioOFallar(nombreUsuario);
        return emitirSesion(usuario);
    }

    /** Emite el par acceso + refresco y registra el refresco en Redis. */
    public SesionResponse emitirSesion(Usuario usuario) {
        String acceso = jwtUtil.generarAccessToken(usuario.getUsuario(), usuario.getRol().name());

        String jti = servicioTokens.nuevoJti();
        String refresco = jwtUtil.generarRefreshToken(usuario.getUsuario(), jti);
        servicioTokens.registrar(jti, usuario.getUsuario(), jwtUtil.getExpiracionRefrescoMs());

        return SesionResponse.de(acceso, refresco, usuario.getUsuario(),
                usuario.getRol(), usuario.getPlan(), jwtUtil.getExpiracionAccesoMs());
    }

    /**
     * Cambia un refresco por un par nuevo.
     *
     * El refresco usado se revoca y se emite otro (rotación): si alguien roba un
     * refresco y lo usa, el legítimo deja de funcionar y el robo se nota.
     *
     * El rol se vuelve a leer de la base de datos, así que un cambio de rol
     * surte efecto en el siguiente refresco sin esperar a que caduque nada.
     */
    public SesionResponse refrescar(String refreshToken) {

        if (!jwtUtil.esRefrescoValido(refreshToken)) {
            throw new OperacionNoPermitidaException("Token de refresco inválido o expirado");
        }

        String nombreUsuario = jwtUtil.extraerUsuario(refreshToken);
        String jti = jwtUtil.extraerJti(refreshToken);

        if (!servicioTokens.esVigente(jti, nombreUsuario)) {
            // Firmado y sin caducar, pero revocado: logout previo, cambio de
            // contraseña, o un refresco ya rotado que alguien intenta reutilizar.
            log.warn("Intento de refresco con un token revocado: '{}'", nombreUsuario);
            throw new OperacionNoPermitidaException("La sesión ya no es válida");
        }

        servicioTokens.revocar(jti, nombreUsuario);

        Usuario usuario = usuarioService.obtenerPorNombreUsuarioOFallar(nombreUsuario);
        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new OperacionNoPermitidaException("La cuenta está desactivada");
        }

        return emitirSesion(usuario);
    }

    /** Cierra una sesión concreta. Los demás dispositivos siguen conectados. */
    public void logout(String refreshToken) {
        if (!jwtUtil.esRefrescoValido(refreshToken)) {
            // Un token ilegible no es motivo de error: el efecto buscado
            // (que deje de servir) ya se cumple.
            return;
        }
        servicioTokens.revocar(
                jwtUtil.extraerJti(refreshToken),
                jwtUtil.extraerUsuario(refreshToken));
    }

    private void verificarNoBloqueado(String clave) {
        if (limiteIntentos.estaBloqueado(clave)) {
            long segundos = limiteIntentos.segundosRestantes(clave);
            throw new OperacionNoPermitidaException(
                    "Demasiados intentos fallidos. Inténtalo de nuevo en " + segundos + " segundos.");
        }
    }
}
