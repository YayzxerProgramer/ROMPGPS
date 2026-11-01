package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Canal2fa;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Rol;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Representación pública de un usuario.
 */
public record UsuarioResponse(
        UUID id,
        String nombre,
        String apellido,
        String usuario,
        String correo,
        String telefono,
        Rol rol,
        PlanTipo plan,
        Boolean activo,
        Boolean dosFactoresActivo,
        Canal2fa canal2fa,
        String imagenUrl,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn) {
}
