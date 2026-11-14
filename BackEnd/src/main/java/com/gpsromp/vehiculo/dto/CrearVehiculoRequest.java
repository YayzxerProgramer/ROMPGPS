package com.gpsromp.vehiculo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Alta de vehículo (POST /vehiculo).
 *
 * La clave JSON id_usuario se mantiene porque es la que ya envía
 * PanelVehiculo.jsx en su payload.
 *
 * La placa se valida a 6 caracteres porque la columna está declarada
 * length = 6: antes una placa más larga reventaba contra la base de datos y
 * salía como 500.
 */
public record CrearVehiculoRequest(

        @NotBlank(message = "La placa es obligatoria")
        @Size(min = 5, max = 6, message = "La placa debe tener entre 5 y 6 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9-]+$", message = "La placa solo admite letras, números y guion")
        String placa,

        @Pattern(regexp = "^$|^[0-9]{15,16}$", message = "El IMEI debe tener 15 o 16 dígitos")
        String imei,

        @NotBlank(message = "El modelo es obligatorio")
        @Size(max = 60, message = "El modelo no puede superar 60 caracteres")
        String modelo,

        @NotBlank(message = "El tipo es obligatorio")
        @Pattern(regexp = "MOTO|CARRO", message = "El tipo debe ser MOTO o CARRO")
        String tipo,

        Boolean activo,

        @JsonProperty("id_usuario") UUID idUsuario,

        LocalDate fechaVencimientoSoat,

        LocalDate fechaVencimientoTecnomecanica) {

    public CrearVehiculoRequest(String placa, String imei, String modelo, String tipo, Boolean activo, UUID idUsuario) {
        this(placa, imei, modelo, tipo, activo, idUsuario, null, null);
    }
}
