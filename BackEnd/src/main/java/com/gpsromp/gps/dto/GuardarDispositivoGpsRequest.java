package com.gpsromp.gps.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record GuardarDispositivoGpsRequest(
        @NotBlank(message = "El IMEI es obligatorio")
        @Pattern(regexp = "^\\d{15,16}$", message = "El IMEI debe contener entre 15 y 16 dígitos numéricos")
        String imei,

        String numeroSim,

        String modelo,

        String operador,

        Boolean activo
) {
}
