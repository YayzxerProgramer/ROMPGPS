package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.Canal2fa;
import jakarta.validation.constraints.NotNull;

public record Actualizar2faRequest(
        @NotNull(message = "El estado de 2FA es obligatorio")
        Boolean activo,

        Canal2fa canal) {
}
