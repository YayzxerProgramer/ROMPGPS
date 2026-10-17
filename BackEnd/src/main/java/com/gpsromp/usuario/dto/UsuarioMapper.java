package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Usuario;

/**
 * Mapeo entidad ↔ DTO, a mano y sin dependencias.
 *
 * Se descarta MapStruct a propósito: añade procesamiento de anotaciones a un
 * módulo que ya tuvo problemas de compilación entre Lombok y la versión del JDK.
 * El mapeo manual es más verboso pero no puede romper el build.
 */
public final class UsuarioMapper {

    private UsuarioMapper() {
    }

    public static UsuarioResponse aResponse(Usuario u) {
        if (u == null) {
            return null;
        }
        return new UsuarioResponse(
                u.getId(),
                u.getNombre(),
                u.getApellido(),
                u.getUsuario(),
                u.getCorreo(),
                u.getTelefono(),
                u.getRol(),
                u.getPlan() != null ? u.getPlan() : com.gpsromp.usuario.model.PlanTipo.PERSONAL,
                u.getActivo(),
                u.getImagenUrl(),
                u.getCreadoEn(),
                u.getActualizadoEn());
    }
}
