package com.gpsromp.gps.dto;

import java.time.Instant;

import com.gpsromp.gps.model.DispositivoGps;

import jakarta.validation.constraints.Pattern;

public record DispositivoGpsDto(
        String id,
        String imei,
        String numeroSim,
        String modelo,
        String operador,
        Boolean activo,
        Instant creadoEn,
        Instant actualizadoEn
) {
    public static DispositivoGpsDto de(DispositivoGps d) {
        if (d == null) return null;
        return new DispositivoGpsDto(
                d.getId(),
                d.getImei(),
                d.getNumeroSim(),
                d.getModelo(),
                d.getOperador(),
                d.getActivo(),
                d.getCreadoEn(),
                d.getActualizadoEn()
        );
    }
}
