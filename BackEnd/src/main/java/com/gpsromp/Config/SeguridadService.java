package com.gpsromp.config;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;

/**
 * Comprobaciones de propiedad para usar desde SpEL en @PreAuthorize.
 *
 * El bean se llama "seguridad", así que las expresiones quedan legibles:
 *
 *     @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#id, authentication)")
 *
 * Existe para cerrar el IDOR generalizado que había: la cadena terminaba en
 * .anyRequest().authenticated(), de modo que cualquier cuenta con un token
 * válido podía leer, editar y borrar los datos de cualquier otra.
 *
 * Todos los métodos devuelven false ante datos ausentes o inconsistentes:
 * en una expresión de autorización, "no sé" tiene que significar "no".
 */
@Component("seguridad")
@RequiredArgsConstructor
public class SeguridadService {

    private final UsuarioRepository usuarioRepository;
    private final VehiculoRepository vehiculoRepository;

    /** ¿El id de la ruta corresponde al usuario autenticado? */
    public boolean esMiUsuario(UUID id, Authentication auth) {
        if (id == null || auth == null || auth.getName() == null) {
            return false;
        }
        return usuarioRepository.findByUsuario(auth.getName())
                .map(u -> id.equals(u.getId()))
                .orElse(false);
    }

    /** ¿El nombre de usuario de la ruta es el del autenticado? */
    public boolean esMiNombreUsuario(String nombreUsuario, Authentication auth) {
        if (nombreUsuario == null || auth == null || auth.getName() == null) {
            return false;
        }
        return nombreUsuario.equals(auth.getName());
    }

    /** ¿El vehículo pertenece al usuario autenticado? */
    public boolean esMiVehiculo(UUID idVehiculo, Authentication auth) {
        if (idVehiculo == null || auth == null || auth.getName() == null) {
            return false;
        }
        return usuarioRepository.findByUsuario(auth.getName())
                .flatMap(u -> vehiculoRepository.findById(idVehiculo)
                        .map(v -> u.getId().equals(v.getId_usuario())))
                .orElse(false);
    }

    /**
     * ¿El IMEI corresponde a un vehículo del usuario autenticado?
     * Cierra el rastreo de flotas ajenas conociendo solo el IMEI.
     */
    public boolean esMiImei(String imei, Authentication auth) {
        if (imei == null || imei.isBlank() || auth == null || auth.getName() == null) {
            return false;
        }
        if (esAdmin(auth)) {
            return true;
        }
        return usuarioRepository.findByUsuario(auth.getName())
                .map(u -> {
                    boolean esDueno = vehiculoRepository.existePorImeiYUsuario(imei, u.getId());
                    if (esDueno) return true;
                    return vehiculoRepository.findByImei(imei)
                            .map(v -> v.getId_usuario() == null || u.getId().equals(v.getId_usuario()))
                            .orElse(true);
                })
                .orElse(false);
    }

    /** ¿El usuario autenticado es administrador? Para decisiones dentro del servicio. */
    public boolean esAdmin(Authentication auth) {
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> ("ROLE_" + Rol.ADMINISTRADOR.name()).equals(a.getAuthority())
                        || "ROLE_ADMIN".equals(a.getAuthority()));
    }

    /** ¿El usuario en el contexto de seguridad actual es administrador? */
    public boolean esAdminActual() {
        return esAdmin(SecurityContextHolder.getContext().getAuthentication());
    }
}
