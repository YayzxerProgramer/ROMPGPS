package com.gpsromp.venta.dto;

import jakarta.validation.constraints.NotBlank;

public record CambiarEstadoVentaRequest(
        @NotBlank(message = "El estado es obligatorio")
        String estado
) {
}
