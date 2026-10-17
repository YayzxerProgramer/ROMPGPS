package com.gpsromp.venta.dto;

import com.gpsromp.usuario.model.PlanTipo;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record CrearVentaRequest(
        @NotNull(message = "El cliente registrado es obligatorio")
        UUID usuarioId,

        @NotBlank(message = "El nombre del cliente es obligatorio")
        @Size(max = 120, message = "El nombre no puede exceder 120 caracteres")
        String clienteNombre,

        @NotBlank(message = "El correo del cliente es obligatorio")
        @Size(max = 120, message = "El correo no puede exceder 120 caracteres")
        String clienteCorreo,

        @NotNull(message = "El plan es obligatorio")
        PlanTipo plan,

        @NotNull(message = "El monto es obligatorio")
        @DecimalMin(value = "0.0", inclusive = false, message = "El monto debe ser mayor a 0")
        BigDecimal monto,

        String periodo, // MENSUAL, ANUAL

        String estado,  // APROBADO, PENDIENTE, CANCELADO

        String metodoPago, // WOMPI, NEQUI, PSE, TARJETA, TRANSFERENCIA, EFECTIVO

        String referencia,

        String notas
) {
}
