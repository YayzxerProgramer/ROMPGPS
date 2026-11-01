package com.gpsromp.usuario.dto;

import lombok.Data;

@Data
public class SolicitarSmsRequest {

    private String telefono;

    private String identificador;
}
