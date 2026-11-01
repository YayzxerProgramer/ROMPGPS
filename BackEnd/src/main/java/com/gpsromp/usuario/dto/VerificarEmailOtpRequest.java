package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class VerificarEmailOtpRequest {

    @NotBlank(message = "El identificador es obligatorio")
    private String identificador;

    @NotBlank(message = "El código es obligatorio")
    @Pattern(regexp = "^[0-9]{6}$", message = "El código debe ser de 6 dígitos numéricos")
    private String codigo;
}
