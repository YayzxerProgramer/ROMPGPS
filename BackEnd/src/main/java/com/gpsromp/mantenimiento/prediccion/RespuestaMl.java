package com.gpsromp.mantenimiento.prediccion;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Respuesta de POST /predecir del ml-service. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RespuestaMl(
        @JsonProperty("km_restantes") double kmRestantes,
        @JsonProperty("nivel") String nivel,
        @JsonProperty("error_tipico_km") Double errorTipicoKm,
        @JsonProperty("km_restantes_fabricante") double kmRestantesFabricante,
        @JsonProperty("umbral_alerta_km") double umbralAlertaKm,
        @JsonProperty("modelo") String modelo,
        @JsonProperty("datos_entrenamiento") String datosEntrenamiento) {
}
