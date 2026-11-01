package com.gpsromp.mantenimiento.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gpsromp.mantenimiento.model.Mantenimiento;

@Repository
public interface MantenimientoRepository extends JpaRepository<Mantenimiento, UUID> {

    /** Del más reciente al más antiguo. El desempate por creación fija el orden de dos del mismo día. */
    List<Mantenimiento> findByVehiculoIdOrderByFechaDescCreadoEnDesc(UUID vehiculoId);

    Optional<Mantenimiento> findFirstByVehiculoIdOrderByFechaDescCreadoEnDesc(UUID vehiculoId);

    /** Se busca por id Y vehículo: evita borrar el mantenimiento de otro vehículo cambiando solo la URL. */
    Optional<Mantenimiento> findByIdAndVehiculoId(UUID id, UUID vehiculoId);

    boolean existsByVehiculoIdAndFechaAndTipo(UUID vehiculoId, LocalDate fecha, String tipo);

    /** Para limpiar al eliminar un vehículo: no hay clave foránea que lo haga en cascada. */
    @Modifying
    @Query("DELETE FROM Mantenimiento m WHERE m.vehiculoId = :vehiculoId")
    int borrarPorVehiculo(@Param("vehiculoId") UUID vehiculoId);
}
