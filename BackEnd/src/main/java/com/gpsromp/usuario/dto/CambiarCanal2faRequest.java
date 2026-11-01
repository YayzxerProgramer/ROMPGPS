package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Canal2fa;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CambiarCanal2faRequest(
        @NotBlank(message = "El ticket de 2FA es obligatorio")
        String ticket2FA,

        @NotNull(message = "El nuevo canal es obligatorio")
        Canal2fa nuevoCanal) {
}
