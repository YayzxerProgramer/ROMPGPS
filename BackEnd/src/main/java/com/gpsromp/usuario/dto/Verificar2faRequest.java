package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;

public record Verificar2faRequest(
        @NotBlank(message = "El ticket de 2FA es obligatorio")
        String ticket2FA,

        @NotBlank(message = "El código de verificación es obligatorio")
        String codigo) {
}
