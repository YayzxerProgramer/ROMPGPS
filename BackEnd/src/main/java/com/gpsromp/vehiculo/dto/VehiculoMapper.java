package com.gpsromp.vehiculo.dto;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.gpsromp.vehiculo.model.Vehiculo;

/** Mapeo entidad ↔ DTO para vehículos. Manual, por la misma razón que UsuarioMapper. */
public final class VehiculoMapper {

    private VehiculoMapper() {
    }

    public static Long calcularDiasRestantes(LocalDate fecha) {
        if (fecha == null) {
            return null;
        }
        return ChronoUnit.DAYS.between(LocalDate.now(), fecha);
    }

    public static String calcularEstadoDocumento(LocalDate fecha) {
        if (fecha == null) {
            return "NO_REGISTRADO";
        }
        long dias = ChronoUnit.DAYS.between(LocalDate.now(), fecha);
        if (dias < 0) {
            return "VENCIDO";
        }
        if (dias <= 30) {
            return "POR_VENCER";
        }
        return "VIGENTE";
    }

    public static VehiculoResponse aResponse(Vehiculo v) {
        if (v == null) {
            return null;
        }
        return new VehiculoResponse(
                v.getId(),
                v.getPlaca(),
                v.getImei(),
                v.getModelo(),
                v.getTipo(),
                v.getActivo(),
                v.getId_usuario(),
                v.getCreadoEn(),
                v.getActualizadoEn(),
                v.getFechaVencimientoSoat(),
                v.getFechaVencimientoTecnomecanica(),
                calcularDiasRestantes(v.getFechaVencimientoSoat()),
                calcularDiasRestantes(v.getFechaVencimientoTecnomecanica()),
                calcularEstadoDocumento(v.getFechaVencimientoSoat()),
                calcularEstadoDocumento(v.getFechaVencimientoTecnomecanica()));
    }
}
