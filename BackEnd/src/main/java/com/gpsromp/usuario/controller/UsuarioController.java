package com.gpsromp.usuario.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.gpsromp.config.SeguridadService;
import com.gpsromp.usuario.dto.*;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.service.ServicioAutenticacion;
import com.gpsromp.usuario.service.ServicioOauth;
import com.gpsromp.usuario.service.UsuarioService;
import com.gpsromp.vehiculo.dto.VehiculoMapper;
import com.gpsromp.vehiculo.dto.VehiculoResponse;
import com.gpsromp.vehiculo.service.VehiculoService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Endpoints de usuario y autenticación.
 *
 * La administración vive en AdminController (/admin/**) y la lógica de OAuth en
 * ServicioOauth: este controlador pasó de ~400 líneas con llamadas HTTP a
 * terceros embebidas a ser una capa fina de enrutado.
 *
 * Autorización (antes la única regla era .anyRequest().authenticated(), de modo
 * que cualquier cuenta podía leer, editar y borrar los datos de cualquier
 * otra):
 *
 * GET /usuario → solo ADMIN
 * GET /usuario/{id} → el propio usuario o un ADMIN
 * PUT /usuario/{id} → el propio usuario o un ADMIN
 * DELETE /usuario/{id} → solo ADMIN
 * PATCH contraseña → el titular (con la actual) o un ADMIN
 * GET /usuario/vehiculos/ → el propio usuario o un ADMIN
 */
@RestController
@RequestMapping("/usuario")
@RequiredArgsConstructor
public class UsuarioController {

    private final UsuarioService usuarioService;
    private final VehiculoService vehiculoService;
    private final ServicioAutenticacion servicioAutenticacion;
    private final ServicioOauth servicioOauth;
    private final SeguridadService seguridadService;

    // ============================================================== consultas

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UsuarioResponse>> obtenerTodosUsuarios() {
        return ResponseEntity.ok(usuarioService.buscar(null, null, null, Pageable.unpaged())
                .map(UsuarioMapper::aResponse)
                .getContent());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#id, authentication)")
    public ResponseEntity<UsuarioResponse> obtenerUsuariosId(@PathVariable UUID id) {
        return ResponseEntity.ok(UsuarioMapper.aResponse(usuarioService.obtenerPorIdOFallar(id)));
    }

    @GetMapping("/usuario/{usuario}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiNombreUsuario(#usuario, authentication)")
    public ResponseEntity<UsuarioResponse> obtenerUsuariosPorUsuario(@PathVariable String usuario) {
        return ResponseEntity.ok(
                UsuarioMapper.aResponse(usuarioService.obtenerPorNombreUsuarioOFallar(usuario)));
    }

    @GetMapping("/vehiculos/{usuarioId}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#usuarioId, authentication)")
    public ResponseEntity<List<VehiculoResponse>> obtenerVehiculosPorUsuario(@PathVariable UUID usuarioId) {
        usuarioService.obtenerPorIdOFallar(usuarioId);
        return ResponseEntity.ok(vehiculoService.obtenerPorUsuario(usuarioId).stream()
                .map(VehiculoMapper::aResponse)
                .toList());
    }

    /** Disponibilidad. Público: lo necesita el formulario de registro. */
    @GetMapping("/exists/usuario/{usuario}")
    public ResponseEntity<Map<String, Boolean>> existeUsuario(@PathVariable String usuario) {
        return ResponseEntity.ok(Map.of("exists", usuarioService.existeUsuario(usuario)));
    }

    @GetMapping("/exists/correo/{correo}")
    public ResponseEntity<Map<String, Boolean>> existeCorreo(@PathVariable String correo) {
        return ResponseEntity.ok(Map.of("exists", usuarioService.existeCorreo(correo)));
    }

    // ============================================================== registro

    /**
     * Registro público.
     *
     * Recibe RegistroRequest, no la entidad Usuario: el DTO no declara rol, id,
     * activo ni vehiculos, así que ya no se puede crear un administrador desde
     * un endpoint sin autenticación.
     */
    @PostMapping
    public ResponseEntity<UsuarioResponse> crearUsuario(@Valid @RequestBody RegistroRequest peticion) {
        Usuario creado = usuarioService.registrar(peticion);
        return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioMapper.aResponse(creado));
    }

    // ============================================================ mutaciones

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#id, authentication)")
    public ResponseEntity<UsuarioResponse> actualizarUsuario(
            @PathVariable UUID id,
            @Valid @RequestBody ActualizarUsuarioRequest peticion) {

        return ResponseEntity.ok(UsuarioMapper.aResponse(usuarioService.actualizar(id, peticion)));
    }

    /**
     * Cambio de contraseña. Exige la actual salvo que quien llame sea ADMIN.
     * Al terminar se revocan todas las sesiones: si alguien había robado un
     * token, cambiar la contraseña debe echarlo fuera.
     */
    @PatchMapping("/contrasena/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#id, authentication)")
    public ResponseEntity<Void> cambiarContrasena(
            @PathVariable UUID id,
            @Valid @RequestBody CambiarContrasenaRequest peticion,
            Authentication auth) {

        usuarioService.cambiarContrasena(id, peticion.contrasenaActual(),
                peticion.nuevaContrasena(), seguridadService.esAdmin(auth));

        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/cambiar-estado/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> cambiarEstadoUsuario(@PathVariable UUID id, Authentication auth) {
        return ResponseEntity.ok(
                UsuarioMapper.aResponse(usuarioService.cambiarEstado(id, auth.getName())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> eliminarUsuario(@PathVariable UUID id, Authentication auth) {
        usuarioService.eliminar(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    // ======================================================== autenticación

    @PostMapping("/login")
    public ResponseEntity<SesionResponse> login(@Valid @RequestBody LoginRequest credenciales,
            HttpServletRequest peticionHttp) {

        return ResponseEntity.ok(servicioAutenticacion.login(
                credenciales.usuario(), credenciales.contrasena(), ipDe(peticionHttp)));
    }

    /**
     * Renueva el par de tokens. El refresco usado se revoca y se emite otro
     * (rotación), de modo que reutilizar uno robado falla.
     */
    @PostMapping("/refrescar")
    public ResponseEntity<SesionResponse> refrescar(@Valid @RequestBody RefrescarRequest peticion) {
        return ResponseEntity.ok(servicioAutenticacion.refrescar(peticion.refreshToken()));
    }

    /**
     * Cierra la sesión en el servidor.
     * Antes no existía: el frontend solo borraba el localStorage, así que el
     * token seguía siendo válido durante 24 horas para quien lo tuviera.
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefrescarRequest peticion) {
        servicioAutenticacion.logout(peticion.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/google")
    public ResponseEntity<SesionResponse> loginConGoogle(@RequestBody Map<String, String> body) {

        String accessToken = requerido(body.get("tokenGoogle"), "Token de Google requerido");
        Usuario usuario = servicioOauth.autenticarConGoogle(accessToken, body.get("telefono"));

        boolean perfilCompleto = usuario.getTelefono() != null && !usuario.getTelefono().isBlank();

        return ResponseEntity.ok(
                servicioAutenticacion.emitirSesion(usuario).conPerfilCompleto(perfilCompleto));
    }

    @PostMapping("/github")
    public ResponseEntity<SesionResponse> loginConGithub(@RequestBody Map<String, String> body) {

        String accessToken = requerido(body.get("tokenGithub"), "Token de GitHub requerido");
        Usuario usuario = servicioOauth.autenticarConGithub(accessToken);

        return ResponseEntity.ok(servicioAutenticacion.emitirSesion(usuario));
    }

    @PostMapping("/github/callback")
    public ResponseEntity<SesionResponse> githubCallback(@RequestBody Map<String, String> body) {

        String code = requerido(body.get("code"), "Falta el código de GitHub");
        String accessToken = servicioOauth.intercambiarCodigoGithub(code);
        Usuario usuario = servicioOauth.autenticarConGithub(accessToken);

        return ResponseEntity.ok(servicioAutenticacion.emitirSesion(usuario));
    }

    // ============================================================== privados

    private String requerido(String valor, String mensaje) {
        if (valor == null || valor.isBlank()) {
            throw new IllegalArgumentException(mensaje);
        }
        return valor;
    }

    /**
     * IP del cliente para el límite de intentos.
     * Se respeta X-Forwarded-For por si hay un proxy delante; si no, la IP de
     * la conexión.
     */
    private String ipDe(HttpServletRequest peticion) {
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            return reenviada.split(",")[0].trim();
        }
        return peticion.getRemoteAddr();
    }
}
