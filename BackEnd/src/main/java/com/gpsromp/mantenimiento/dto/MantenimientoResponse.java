package com.gpsromp.mantenimiento.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.gpsromp.mantenimiento.model.Mantenimiento;

/**
 * Representación pública de un mantenimiento.
 *
 * La clave JSON id_vehiculo sigue la convención de VehiculoResponse (id_usuario).
 */
public record MantenimientoResponse(
        UUID id,
        @JsonProperty("id_vehiculo") UUID idVehiculo,
        LocalDate fecha,
        String tipo,
        String notas,
        LocalDateTime creadoEn) {

    public static MantenimientoResponse desde(Mantenimiento m) {
        return new MantenimientoResponse(
                m.getId(), m.getVehiculoId(), m.getFecha(), m.getTipo(), m.getNotas(), m.getCreadoEn());
    }
}
