package com.gpsromp.vehiculo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Representación pública de un vehículo.
 *
 * La clave JSON id_usuario se conserva con @JsonProperty porque PanelVehiculo.jsx
 * y PanelControl.jsx ya la leen y la envían con ese nombre exacto.
 */
public record VehiculoResponse(
        UUID id,
        String placa,
        String imei,
        String modelo,
        String tipo,
        Boolean activo,
        @JsonProperty("id_usuario") UUID idUsuario,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        LocalDate fechaVencimientoSoat,
        LocalDate fechaVencimientoTecnomecanica,
        Long diasParaVencerSoat,
        Long diasParaVencerTecnomecanica,
        String estadoSoat,
        String estadoTecnomecanica) {
}
