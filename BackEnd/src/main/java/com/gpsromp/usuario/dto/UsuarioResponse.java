package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Rol;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Representación pública de un usuario.
 *
 * No declara el campo contrasena, así que el hash BCrypt no puede filtrarse por
 * ninguna vía. Antes se serializaba la entidad Usuario entera y el hash viajaba
 * al navegador en GET /usuario, GET /usuario/{id}, GET /usuario/usuario/{u},
 * la respuesta del registro y la del PUT.
 *
 * Los nombres de campo coinciden con los que ya consume el frontend
 * (PanelControl, PerfilUsuario, CambiarContrasena, PanelVehiculo), así que el
 * cambio es transparente para el cliente.
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
        String imagenUrl,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn) {
}
