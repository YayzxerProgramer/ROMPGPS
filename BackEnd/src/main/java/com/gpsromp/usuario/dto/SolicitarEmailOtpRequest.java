package com.gpsromp.usuario.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SolicitarEmailOtpRequest {

    @NotBlank(message = "Debes ingresar tu usuario, correo o teléfono")
    private String identificador;
}
