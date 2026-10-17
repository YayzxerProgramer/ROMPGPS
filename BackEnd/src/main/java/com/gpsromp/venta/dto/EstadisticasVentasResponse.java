package com.gpsromp.venta.dto;

import com.gpsromp.usuario.model.PlanTipo;

import java.math.BigDecimal;
import java.util.List;

public record EstadisticasVentasResponse(
        BigDecimal totalIngresos,
        long totalVentas,
        BigDecimal ticketPromedio,
        long ventasAprobadas,
        long ventasPendientes,
        long ventasCanceladas,
        List<DistribucionPlanDto> porPlan,
        List<DistribucionMetodoDto> porMetodo,
        List<DistribucionPeriodoDto> porPeriodo,
        List<VentaResponse> ultimasVentas
) {
    public record DistribucionPlanDto(
            PlanTipo plan,
            String nombre,
            long cantidad,
            BigDecimal totalMonto,
            int porcentaje
    ) {}

    public record DistribucionMetodoDto(
            String metodo,
            long cantidad,
            BigDecimal totalMonto,
            int porcentaje
    ) {}

    public record DistribucionPeriodoDto(
            String periodo,
            long cantidad,
            BigDecimal totalMonto,
            int porcentaje
    ) {}
}
