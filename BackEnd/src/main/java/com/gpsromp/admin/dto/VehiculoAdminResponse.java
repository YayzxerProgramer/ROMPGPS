package com.gpsromp.admin.dto;

import java.time.LocalDateTime;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Representación enriquecida de un vehículo para el panel administrativo.
 * Incluye logística y cálculos resueltos en el backend:
 * - Estado operativo de rastreo ("marcha", "detenido", "sin", "nogps", "off")
 * - Propietario consolidado
 * - Última posición de telemetría
 * - Línea celular / SIM Card del dispositivo GPS (extraída desde MongoDB para visibilidad administrativa)
 */
public record VehiculoAdminResponse(
        UUID id,
        String placa,
        String imei,
        String numeroSim,
        String modelo,
        String tipo,
        Boolean activo,
        @JsonProperty("id_usuario") UUID idUsuario,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn,
        String estado,
        String nombrePropietario,
        PropietarioResumenResponse propietario,
        PosicionResumenResponse ultimaPosicion
) {
}
