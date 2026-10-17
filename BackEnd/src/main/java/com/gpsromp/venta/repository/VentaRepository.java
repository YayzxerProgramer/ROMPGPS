package com.gpsromp.venta.repository;

import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.venta.model.Venta;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VentaRepository extends JpaRepository<Venta, UUID> {

    Optional<Venta> findByReferencia(String referencia);

    List<Venta> findByUsuarioId(UUID usuarioId);

    @Query("SELECT v FROM Venta v WHERE " +
           "(:busqueda IS NULL OR :busqueda = '' OR " +
           " LOWER(v.referencia) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR " +
           " LOWER(v.clienteNombre) LIKE LOWER(CONCAT('%', :busqueda, '%')) OR " +
           " LOWER(v.clienteCorreo) LIKE LOWER(CONCAT('%', :busqueda, '%'))) " +
           "AND (:plan IS NULL OR v.plan = :plan) " +
           "AND (:estado IS NULL OR :estado = '' OR v.estado = :estado)")
    Page<Venta> buscar(@Param("busqueda") String busqueda,
                       @Param("plan") PlanTipo plan,
                       @Param("estado") String estado,
                       Pageable pageable);

    long countByEstado(String estado);

    @Query("SELECT COALESCE(SUM(v.monto), 0) FROM Venta v WHERE v.estado = :estado")
    BigDecimal sumMontoByEstado(@Param("estado") String estado);

    long countByPlanAndEstado(PlanTipo plan, String estado);

    @Query("SELECT COALESCE(SUM(v.monto), 0) FROM Venta v WHERE v.plan = :plan AND v.estado = :estado")
    BigDecimal sumMontoByPlanAndEstado(@Param("plan") PlanTipo plan, @Param("estado") String estado);

    @Query("SELECT v.metodoPago, COUNT(v), COALESCE(SUM(v.monto), 0) FROM Venta v WHERE v.estado = :estado GROUP BY v.metodoPago")
    List<Object[]> agruparPorMetodoPagoYEstado(@Param("estado") String estado);

    @Query("SELECT v.periodo, COUNT(v), COALESCE(SUM(v.monto), 0) FROM Venta v WHERE v.estado = :estado GROUP BY v.periodo")
    List<Object[]> agruparPorPeriodoYEstado(@Param("estado") String estado);

    List<Venta> findTop10ByOrderByCreadoEnDesc();
}
