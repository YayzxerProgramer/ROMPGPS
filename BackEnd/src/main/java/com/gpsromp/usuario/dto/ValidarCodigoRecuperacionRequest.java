package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;

public record ValidarCodigoRecuperacionRequest(
        @NotBlank(message = "El identificador es obligatorio")
        String identificador,

        @NotBlank(message = "El código es obligatorio")
        String codigo
) {
}
