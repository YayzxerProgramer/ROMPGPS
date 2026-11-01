package com.gpsromp.mantenimiento.prediccion;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Las 10 variables que espera el ml-service (mismos nombres que
 * ml-service/app/common.py). Los @JsonProperty fijan el nombre exacto del JSON.
 */
public record CaracteristicasCiclo(
        @JsonProperty("tipo_vehiculo") String tipoVehiculo,
        @JsonProperty("tipo_ultimo_mant") String tipoUltimoMant,
        @JsonProperty("km_desde_ult_mant") double kmDesdeUltMant,
        @JsonProperty("dias_desde_ult_mant") double diasDesdeUltMant,
        @JsonProperty("horas_mov_desde_mant") double horasMovDesdeMant,
        @JsonProperty("num_mant_previos") double numMantPrevios,
        @JsonProperty("km_diarios_prom_30d") double kmDiariosProm30d,
        @JsonProperty("vel_prom_mov_30d") double velPromMov30d,
        @JsonProperty("paradas_por_100km") double paradasPor100km,
        @JsonProperty("dist_media_recorrido_km") double distMediaRecorridoKm) {
}
