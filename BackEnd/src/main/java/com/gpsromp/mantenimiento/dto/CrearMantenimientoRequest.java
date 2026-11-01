package com.gpsromp.mantenimiento.dto;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

/**
 * Alta de un mantenimiento (POST /vehiculo/{idVehiculo}/mantenimientos).
 *
 * La fecha no puede ser futura: un mantenimiento "programado" no es un
 * mantenimiento hecho y falsearía el cálculo de kilómetros desde el último.
 */
public record CrearMantenimientoRequest(

        @NotNull(message = "La fecha es obligatoria")
        @PastOrPresent(message = "La fecha no puede ser futura")
        LocalDate fecha,

        @NotBlank(message = "El tipo es obligatorio")
        @Pattern(regexp = "PREVENTIVO|CORRECTIVO", message = "El tipo debe ser PREVENTIVO o CORRECTIVO")
        String tipo,

        @Size(max = 500, message = "Las notas no pueden superar 500 caracteres")
        String notas) {
}
