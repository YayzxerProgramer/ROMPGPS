package com.gpsromp.pago.dto;

import com.gpsromp.usuario.model.PlanTipo;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record ConfirmarCompraRequest(
        @NotBlank(message = "La referencia de pago es obligatoria")
        String referencia,

        String transaccionId,

        @NotNull(message = "El plan es obligatorio")
        PlanTipo plan,

        String periodo,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.0", message = "El monto no puede ser negativo")
        BigDecimal monto,

        String metodoPago
) {
}
