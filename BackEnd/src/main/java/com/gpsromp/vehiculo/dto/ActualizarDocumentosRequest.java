package com.gpsromp.vehiculo.dto;

import java.time.LocalDate;

/**
 * Petición para actualizar las fechas de vencimiento de documentos (SOAT y Tecnomecánica).
 */
public record ActualizarDocumentosRequest(
        LocalDate fechaVencimientoSoat,
        LocalDate fechaVencimientoTecnomecanica
) {
}
