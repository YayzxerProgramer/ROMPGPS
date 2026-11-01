package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Canal2fa;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Usuario;

/**
 * Mapeo entidad ↔ DTO, a mano y sin dependencias.
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
                u.getPlan() != null ? u.getPlan() : PlanTipo.PERSONAL,
                u.getActivo(),
                u.getDosFactoresActivo() != null ? u.getDosFactoresActivo() : false,
                u.getCanal2fa() != null ? u.getCanal2fa() : Canal2fa.CORREO,
                u.getImagenUrl(),
                u.getCreadoEn(),
                u.getActualizadoEn());
    }
}
