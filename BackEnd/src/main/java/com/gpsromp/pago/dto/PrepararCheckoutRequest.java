package com.gpsromp.pago.dto;

import jakarta.validation.constraints.NotBlank;

public record PrepararCheckoutRequest(
        @NotBlank String plan,
        @NotBlank String periodo) {
}
