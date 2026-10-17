package com.gpsromp.venta.service;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.venta.dto.CrearVentaRequest;
import com.gpsromp.venta.dto.EstadisticasVentasResponse;
import com.gpsromp.venta.dto.VentaResponse;
import com.gpsromp.venta.model.Venta;
import com.gpsromp.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class VentaService {

    private final VentaRepository ventaRepository;
    private final UsuarioRepository usuarioRepository;

    @Transactional(readOnly = true)
    public EstadisticasVentasResponse obtenerEstadisticas() {
        BigDecimal totalIngresos = ventaRepository.sumMontoByEstado("APROBADO");
        long ventasAprobadas = ventaRepository.countByEstado("APROBADO");
        long ventasPendientes = ventaRepository.countByEstado("PENDIENTE");
        long ventasCanceladas = ventaRepository.countByEstado("CANCELADO");

        BigDecimal ticketPromedio = ventasAprobadas > 0
                ? totalIngresos.divide(BigDecimal.valueOf(ventasAprobadas), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // Distribución por Plan
        List<EstadisticasVentasResponse.DistribucionPlanDto> porPlan = new ArrayList<>();
        for (PlanTipo plan : PlanTipo.values()) {
            long cant = ventaRepository.countByPlanAndEstado(plan, "APROBADO");
            BigDecimal monto = ventaRepository.sumMontoByPlanAndEstado(plan, "APROBADO");
            int pct = ventasAprobadas > 0 ? (int) Math.round((double) cant / ventasAprobadas * 100) : 0;
            porPlan.add(new EstadisticasVentasResponse.DistribucionPlanDto(
                    plan, plan.getNombre(), cant, monto, pct
            ));
        }

        // Distribución por Método de Pago
        List<EstadisticasVentasResponse.DistribucionMetodoDto> porMetodo = new ArrayList<>();
        List<Object[]> filasMetodos = ventaRepository.agruparPorMetodoPagoYEstado("APROBADO");
        for (Object[] fila : filasMetodos) {
            String metodo = fila[0] != null ? fila[0].toString() : "OTRO";
            long cant = ((Number) fila[1]).longValue();
            BigDecimal monto = (BigDecimal) fila[2];
            int pct = ventasAprobadas > 0 ? (int) Math.round((double) cant / ventasAprobadas * 100) : 0;
            porMetodo.add(new EstadisticasVentasResponse.DistribucionMetodoDto(
                    metodo, cant, monto, pct
            ));
        }

        // Distribución por Periodo (Mensual vs Anual)
        List<EstadisticasVentasResponse.DistribucionPeriodoDto> porPeriodo = new ArrayList<>();
        List<Object[]> filasPeriodo = ventaRepository.agruparPorPeriodoYEstado("APROBADO");
        for (Object[] fila : filasPeriodo) {
            String periodo = fila[0] != null ? fila[0].toString() : "MENSUAL";
            long cant = ((Number) fila[1]).longValue();
            BigDecimal monto = (BigDecimal) fila[2];
            int pct = ventasAprobadas > 0 ? (int) Math.round((double) cant / ventasAprobadas * 100) : 0;
            porPeriodo.add(new EstadisticasVentasResponse.DistribucionPeriodoDto(
                    periodo, cant, monto, pct
            ));
        }

        List<VentaResponse> ultimasVentas = ventaRepository.findTop10ByOrderByCreadoEnDesc().stream()
                .map(VentaResponse::de)
                .toList();

        return new EstadisticasVentasResponse(
                totalIngresos,
                ventasAprobadas,
                ticketPromedio,
                ventasAprobadas,
                ventasPendientes,
                ventasCanceladas,
                porPlan,
                porMetodo,
                porPeriodo,
                ultimasVentas
        );
    }

    @Transactional(readOnly = true)
    public Page<VentaResponse> listarVentas(String busqueda, PlanTipo plan, String estado, Pageable pageable) {
        return ventaRepository.buscar(busqueda, plan, estado, pageable).map(VentaResponse::de);
    }

    @Transactional(readOnly = true)
    public VentaResponse obtenerPorId(UUID id) {
        return ventaRepository.findById(id)
                .map(VentaResponse::de)
                .orElseThrow(() -> new RecursoNoEncontradoException("Venta no encontrada con ID: " + id));
    }

    @Transactional
    public VentaResponse crearVenta(CrearVentaRequest req) {
        Usuario usuario = usuarioRepository.findById(req.usuarioId())
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado con ID: " + req.usuarioId()));

        if ("APROBADO".equalsIgnoreCase(req.estado() != null ? req.estado() : "APROBADO")) {
            usuario.setPlan(req.plan());
            usuarioRepository.save(usuario);
            log.info("Plan actualizado a {} para el usuario {}", req.plan(), usuario.getUsuario());
        }

        String nombreCompleto = ((usuario.getNombre() != null ? usuario.getNombre() : "") + " " +
                (usuario.getApellido() != null ? usuario.getApellido() : "")).trim();
        if (nombreCompleto.isBlank()) {
            nombreCompleto = usuario.getUsuario();
        }

        String ref = req.referencia();
        if (ref == null || ref.isBlank()) {
            ref = "VEN-" + System.currentTimeMillis() + "-" + req.plan().name().substring(0, Math.min(3, req.plan().name().length()));
        }

        Venta venta = Venta.builder()
                .usuario(usuario)
                .clienteNombre(nombreCompleto)
                .clienteCorreo(usuario.getCorreo())
                .plan(req.plan())
                .monto(req.monto())
                .periodo(req.periodo() != null && !req.periodo().isBlank() ? req.periodo().toUpperCase() : "MENSUAL")
                .estado(req.estado() != null && !req.estado().isBlank() ? req.estado().toUpperCase() : "APROBADO")
                .metodoPago(req.metodoPago() != null && !req.metodoPago().isBlank() ? req.metodoPago().toUpperCase() : "WOMPI")
                .referencia(ref)
                .notas(req.notas())
                .build();

        Venta guardada = ventaRepository.save(venta);
        log.info("Venta creada exitosamente con ID {} y Ref {}", guardada.getId(), guardada.getReferencia());
        return VentaResponse.de(guardada);
    }

    @Transactional
    public VentaResponse actualizarEstado(UUID id, String nuevoEstado) {
        Venta venta = ventaRepository.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Venta no encontrada con ID: " + id));

        venta.setEstado(nuevoEstado.toUpperCase());
        if ("APROBADO".equalsIgnoreCase(nuevoEstado) && venta.getUsuario() != null) {
            venta.getUsuario().setPlan(venta.getPlan());
            usuarioRepository.save(venta.getUsuario());
        }

        Venta actualizada = ventaRepository.save(venta);
        log.info("Estado de venta {} actualizado a {}", id, nuevoEstado);
        return VentaResponse.de(actualizada);
    }

    @Transactional
    public void eliminarVenta(UUID id) {
        if (!ventaRepository.existsById(id)) {
            throw new RecursoNoEncontradoException("Venta no encontrada con ID: " + id);
        }
        ventaRepository.deleteById(id);
        log.info("Venta eliminada: {}", id);
    }
}
