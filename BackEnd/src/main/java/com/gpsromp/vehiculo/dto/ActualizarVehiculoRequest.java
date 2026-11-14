package com.gpsromp.vehiculo.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Actualización de vehículo (PUT /vehiculo/{id}).
 *
 * Semántica de patch: los campos null se dejan como estaban.
 *
 * Esto arregla una pérdida de datos silenciosa. VehiculoService.actualizarVehiculo
 * asignaba los seis campos sin comprobar null, así que un PUT parcial ponía imei,
 * activo e id_usuario a null y dejaba el vehículo sin dueño y desvinculado del GPS.
 *
 * id_usuario no está aquí a propósito: reasignar un vehículo a otro propietario es
 * una operación de administración y vive en PUT /admin/vehiculos/{id}/usuario.
 */
public record ActualizarVehiculoRequest(

        @Size(min = 5, max = 6, message = "La placa debe tener entre 5 y 6 caracteres")
        @Pattern(regexp = "^[A-Za-z0-9-]+$", message = "La placa solo admite letras, números y guion")
        String placa,

        @Pattern(regexp = "^$|^[0-9]{15,16}$", message = "El IMEI debe tener 15 o 16 dígitos")
        String imei,

        @Size(max = 60, message = "El modelo no puede superar 60 caracteres")
        String modelo,

        @Pattern(regexp = "MOTO|CARRO", message = "El tipo debe ser MOTO o CARRO")
        String tipo,

        Boolean activo,

        LocalDate fechaVencimientoSoat,

        LocalDate fechaVencimientoTecnomecanica) {

    public ActualizarVehiculoRequest(String placa, String imei, String modelo, String tipo, Boolean activo) {
        this(placa, imei, modelo, tipo, activo, null, null);
    }
}
