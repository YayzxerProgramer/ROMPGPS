package com.gpsromp.venta.dto;

import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.venta.model.Venta;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public record VentaResponse(
        UUID id,
        UUID usuarioId,
        String clienteNombre,
        String clienteCorreo,
        PlanTipo plan,
        String planNombre,
        BigDecimal monto,
        String periodo,
        String estado,
        String metodoPago,
        String referencia,
        String notas,
        LocalDateTime creadoEn,
        LocalDateTime actualizadoEn
) {
    public static VentaResponse de(Venta v) {
        if (v == null) return null;
        return new VentaResponse(
                v.getId(),
                v.getUsuario() != null ? v.getUsuario().getId() : null,
                v.getClienteNombre(),
                v.getClienteCorreo(),
                v.getPlan(),
                v.getPlan() != null ? v.getPlan().getNombre() : "",
                v.getMonto(),
                v.getPeriodo(),
                v.getEstado(),
                v.getMetodoPago(),
                v.getReferencia(),
                v.getNotas(),
                v.getCreadoEn(),
                v.getActualizadoEn()
        );
    }
}
