package com.gpsromp.usuario.service;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gpsromp.config.ServicioTokens;
import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoDuplicadoException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.usuario.dto.ActualizarUsuarioRequest;
import com.gpsromp.usuario.dto.CrearUsuarioAdminRequest;
import com.gpsromp.usuario.dto.RegistroRequest;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;

/**
 * Lógica de usuarios.
 *
 * Nota sobre la caché: se retiró @Cacheable("usuarios") de los listados. El
 * RedisTemplate del proyecto serializa sin default typing, así que en un
 * cache-hit la lista volvía como List<LinkedHashMap> disfrazada de
 * List<Usuario> y cualquier acceso tipado lanzaba ClassCastException. Además
 * cacheaba entidades con el hash BCrypt dentro de un Redis sin contraseña.
 * Arreglar la serialización queda fuera del alcance de esta tarea; quitar la
 * caché de aquí es correcto y no reintroduce el fallo.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final VehiculoRepository vehiculoRepository;
    private final PasswordEncoder passwordEncoder;
    private final ServicioTokens servicioTokens;

    // ---------------------------------------------------------------- consultas

    /** Listado paginado con búsqueda y filtros. Alimenta la tabla del panel. */
    public Page<Usuario> buscar(String busqueda, Rol rol, Boolean activo, Pageable pageable) {
        String texto = (busqueda == null) ? "" : busqueda.trim();
        return usuarioRepository.buscar(texto, rol, activo, pageable);
    }

    public Usuario obtenerPorIdOFallar(UUID id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> RecursoNoEncontradoException.usuario(id));
    }

    public Optional<Usuario> obtenerPorId(UUID id) {
        return usuarioRepository.findById(id);
    }

    public Optional<Usuario> obtenerPorNombreUsuario(String usuario) {
        return usuarioRepository.findByUsuario(usuario);
    }

    public Usuario obtenerPorNombreUsuarioOFallar(String usuario) {
        return usuarioRepository.findByUsuario(usuario)
                .orElseThrow(() -> RecursoNoEncontradoException.usuario(usuario));
    }

    public Optional<Usuario> obtenerPorCorreo(String correo) {
        return usuarioRepository.findByCorreo(correo);
    }

    public boolean existeUsuario(String usuario) {
        return usuarioRepository.existsByUsuario(usuario);
    }

    public boolean existeCorreo(String correo) {
        return usuarioRepository.existsByCorreo(correo);
    }

    public long contarTodos() {
        return usuarioRepository.count();
    }

    public long contarActivos() {
        return usuarioRepository.countByActivoTrue();
    }

    public long contarPorRol(Rol rol) {
        return usuarioRepository.countByRol(rol);
    }

    // ------------------------------------------------------------------- altas

    /**
     * Registro público. El rol NO se toma del cliente: siempre USER.
     *
     * Este es el punto donde se cierra la escalada de privilegios: antes el
     * método recibía la entidad Usuario entera y solo forzaba "USER" si el rol
     * venía vacío, de modo que {"rol":"ADMIN"} pasaba tal cual.
     */
    @Transactional
    public Usuario registrar(RegistroRequest peticion) {
        validarDisponibilidad(peticion.usuario(), peticion.correo());

        Usuario usuario = new Usuario();
        usuario.setNombre(peticion.nombre());
        usuario.setApellido(peticion.apellido());
        usuario.setUsuario(peticion.usuario());
        usuario.setCorreo(peticion.correo());
        usuario.setTelefono(vacioANull(peticion.telefono()));
        usuario.setContrasena(passwordEncoder.encode(peticion.contrasena()));
        usuario.setRol(Rol.USUARIO);
        usuario.setActivo(true);

        return usuarioRepository.save(usuario);
    }

    /**
     * Alta desde el panel. Aquí sí se acepta el rol, porque quien llama es ADMIN.
     */
    @Transactional
    public Usuario crearComoAdmin(CrearUsuarioAdminRequest peticion) {
        validarDisponibilidad(peticion.usuario(), peticion.correo());

        Usuario usuario = new Usuario();
        usuario.setNombre(peticion.nombre());
        usuario.setApellido(peticion.apellido());
        usuario.setUsuario(peticion.usuario());
        usuario.setCorreo(peticion.correo());
        usuario.setTelefono(vacioANull(peticion.telefono()));
        usuario.setContrasena(passwordEncoder.encode(peticion.contrasena()));
        usuario.setRol(peticion.rol());
        usuario.setPlan(peticion.plan() != null ? peticion.plan() : PlanTipo.PERSONAL);
        usuario.setActivo(peticion.activo() == null || peticion.activo());
        usuario.setImagenUrl(peticion.imagenUrl());

        return usuarioRepository.save(usuario);
    }

    /**
     * Alta de usuarios que llegan por OAuth (Google / GitHub).
     * Se mantiene separada porque no hay contraseña elegida por la persona.
     */
    @Transactional
    public Usuario crearDesdeOauth(Usuario usuario) {
        usuario.setRol(Rol.USUARIO);
        usuario.setPlan(PlanTipo.PERSONAL);
        usuario.setActivo(true);
        usuario.setContrasena(passwordEncoder.encode(usuario.getContrasena()));
        return usuarioRepository.save(usuario);
    }

    // ------------------------------------------------------------- mutaciones

    /**
     * Patch de perfil. Los campos null se dejan como estaban. No toca rol ni
     * activo.
     */
    @Transactional
    public Usuario actualizar(UUID id, ActualizarUsuarioRequest peticion) {
        Usuario usuario = obtenerPorIdOFallar(id);

        if (peticion.nombre() != null) {
            usuario.setNombre(peticion.nombre());
        }
        if (peticion.apellido() != null) {
            usuario.setApellido(peticion.apellido());
        }
        if (peticion.usuario() != null && !peticion.usuario().equals(usuario.getUsuario())) {
            if (usuarioRepository.existsByUsuarioAndIdNot(peticion.usuario(), id)) {
                throw new RecursoDuplicadoException("El nombre de usuario ya existe");
            }
            usuario.setUsuario(peticion.usuario());
        }
        if (peticion.correo() != null && !peticion.correo().equals(usuario.getCorreo())) {
            if (usuarioRepository.existsByCorreoAndIdNot(peticion.correo(), id)) {
                throw new RecursoDuplicadoException("El correo ya está registrado");
            }
            usuario.setCorreo(peticion.correo());
        }
        if (peticion.telefono() != null) {
            usuario.setTelefono(vacioANull(peticion.telefono()));
        }
        if (peticion.plan() != null) {
            usuario.setPlan(peticion.plan());
        }
        if (peticion.imagenUrl() != null) {
            usuario.setImagenUrl(peticion.imagenUrl());
        }

        return usuarioRepository.save(usuario);
    }

    /**
     * Cambio de plan desde el panel administrativo.
     */
    @Transactional
    public Usuario cambiarPlan(UUID id, PlanTipo nuevoPlan) {
        Usuario usuario = obtenerPorIdOFallar(id);
        usuario.setPlan(nuevoPlan != null ? nuevoPlan : PlanTipo.PERSONAL);
        return usuarioRepository.save(usuario);
    }

    /**
     * Cambio de rol. Solo ADMIN.
     *
     * Regla del último administrador: si se degrada al único ADMIN que queda,
     * el sistema se queda sin acceso administrativo y sin forma de recuperarlo
     * desde la interfaz. Se bloquea.
     */
    @Transactional
    public Usuario cambiarRol(UUID id, Rol nuevoRol, String usuarioSolicitante) {
        Usuario usuario = obtenerPorIdOFallar(id);

        if (usuario.getRol() == nuevoRol) {
            return usuario;
        }

        if (usuario.getRol() == Rol.ADMINISTRADOR) {
            if (usuario.getUsuario().equals(usuarioSolicitante)) {
                throw new OperacionNoPermitidaException(
                        "No puedes quitarte a ti mismo el rol de administrador");
            }
            verificarQueNoEsElUltimoAdmin();
        }

        usuario.setRol(nuevoRol);
        return usuarioRepository.save(usuario);
    }

    /**
     * Activa o desactiva. Un usuario inactivo no puede autenticarse:
     * ServicioDetallesUsuario lo rechaza y JwtFilter responde 401.
     */
    @Transactional
    public Usuario cambiarEstado(UUID id, String usuarioSolicitante) {
        Usuario usuario = obtenerPorIdOFallar(id);

        if (usuario.getUsuario().equals(usuarioSolicitante)) {
            throw new OperacionNoPermitidaException("No puedes desactivar tu propia cuenta");
        }

        boolean estabaActivo = Boolean.TRUE.equals(usuario.getActivo());
        if (estabaActivo && usuario.getRol() == Rol.ADMINISTRADOR) {
            verificarQueNoEsElUltimoAdmin();
        }

        usuario.setActivo(!estabaActivo);

        if (estabaActivo) {
            // Desactivar sin revocar dejaria vivo su refresco durante 7 dias.
            servicioTokens.revocarTodas(usuario.getUsuario());
        }

        return usuarioRepository.save(usuario);
    }

    @Transactional
    public void eliminar(UUID id, String usuarioSolicitante) {
        Usuario usuario = obtenerPorIdOFallar(id);

        if (usuario.getUsuario().equals(usuarioSolicitante)) {
            throw new OperacionNoPermitidaException("No puedes eliminar tu propia cuenta");
        }
        if (usuario.getRol() == Rol.ADMINISTRADOR) {
            verificarQueNoEsElUltimoAdmin();
        }

        servicioTokens.revocarTodas(usuario.getUsuario());
        // Sus vehículos vuelven al inventario en vez de quedar huérfanos.
        vehiculoRepository.desasignarDeUsuario(id);
        usuarioRepository.delete(usuario);
    }

    /**
     * Cambio de contraseña.
     *
     * Si quien llama NO es administrador, debe aportar la contraseña actual y
     * que coincida. Antes no se pedía nada, así que cualquier cuenta autenticada
     * podía apoderarse de cualquier otra.
     */
    @Transactional
    public void cambiarContrasena(UUID id, String contrasenaActual, String nuevaContrasena, boolean esAdmin) {
        Usuario usuario = obtenerPorIdOFallar(id);

        if (!esAdmin) {
            if (contrasenaActual == null || contrasenaActual.isBlank()) {
                throw new OperacionNoPermitidaException("Debes indicar tu contraseña actual");
            }
            if (!passwordEncoder.matches(contrasenaActual, usuario.getContrasena())) {
                throw new OperacionNoPermitidaException("La contraseña actual no es correcta");
            }
        }

        usuario.setContrasena(passwordEncoder.encode(nuevaContrasena));
        usuarioRepository.save(usuario);

        // Si alguien habia robado un token, cambiar la contrasena debe echarlo
        // fuera. Antes el token seguia valido hasta caducar.
        servicioTokens.revocarTodas(usuario.getUsuario());
    }

    // --------------------------------------------------------------- privados

    private void validarDisponibilidad(String usuario, String correo) {
        if (usuarioRepository.existsByUsuario(usuario)) {
            throw new RecursoDuplicadoException("El nombre de usuario ya existe");
        }
        if (usuarioRepository.existsByCorreo(correo)) {
            throw new RecursoDuplicadoException("El correo ya está registrado");
        }
    }

    private void verificarQueNoEsElUltimoAdmin() {
        if (usuarioRepository.countByRol(Rol.ADMINISTRADOR) <= 1) {
            throw new OperacionNoPermitidaException(
                    "Debe quedar al menos un administrador activo en el sistema");
        }
    }

    private String vacioANull(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor;
    }
}
