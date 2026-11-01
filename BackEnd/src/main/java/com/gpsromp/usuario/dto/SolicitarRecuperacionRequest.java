package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;

public record SolicitarRecuperacionRequest(
        @NotBlank(message = "Debes ingresar tu correo o nombre de usuario")
        String identificador) {
}
