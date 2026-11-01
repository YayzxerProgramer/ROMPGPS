package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestablecerContrasenaRequest(
        @NotBlank(message = "El identificador es obligatorio")
        String identificador,

        @NotBlank(message = "El código es obligatorio")
        String codigo,

        @NotBlank(message = "La nueva contraseña es obligatoria")
        @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
        String nuevaContrasena) {
}
