package com.gpsromp.pago.dto;

public record PrepararCheckoutResponse(
        String publicKey,
        String referencia,
        long montoCentavos,
        String firmaIntegridad) {
}
