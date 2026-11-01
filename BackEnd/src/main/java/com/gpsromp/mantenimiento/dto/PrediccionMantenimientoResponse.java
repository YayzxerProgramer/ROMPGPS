package com.gpsromp.mantenimiento.dto;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Predicción de mantenimiento de un vehículo.
 *
 * estado:
 *   OK                      hay predicción (kmRestantes, nivel...).
 *   SIN_MANTENIMIENTO       el vehículo no tiene ningún mantenimiento registrado: no hay desde dónde contar.
 *   SIN_DATOS_GPS           sin IMEI, sin posiciones, o sin recorrido suficiente desde el último mantenimiento.
 *   SERVICIO_NO_DISPONIBLE  el ml-service no respondió. No es un error del usuario ni del vehículo.
 *
 * datosSimulados = true mientras el modelo se haya entrenado solo con datos
 * simulados: la interfaz debe decirlo, para no presentar la cifra como medida real.
 */
public record PrediccionMantenimientoResponse(
        String estado,
        String mensaje,
        Double kmRestantes,
        String nivel,
        Double errorTipicoKm,
        Double kmRestantesFabricante,
        LocalDate ultimoMantenimiento,
        Double kmDesdeUltimoMantenimiento,
        Long diasDesdeUltimoMantenimiento,
        boolean datosIncompletos,
        boolean datosSimulados,
        Instant calculadoEn) {

    public static PrediccionMantenimientoResponse sinEstimacion(String estado, String mensaje, LocalDate ultimo) {
        return new PrediccionMantenimientoResponse(estado, mensaje, null, null, null, null,
                ultimo, null, null, false, false, Instant.now());
    }
}
