package com.gpsromp.vehiculo.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.gpsromp.vehiculo.model.Vehiculo;

@Repository
public interface VehiculoRepository extends JpaRepository<Vehiculo, UUID> {

    Optional<Vehiculo> findByPlaca(String placa);

    Optional<Vehiculo> findByImei(String imei);

    boolean existsByPlaca(String placa);

    /**
     * Faltaba. Sin esto, POST /vehiculo con un IMEI repetido no se validaba y
     * reventaba contra la constraint UNIQUE como un 500.
     */
    boolean existsByImei(String imei);

    boolean existsByPlacaAndIdNot(String placa, UUID id);

    boolean existsByImeiAndIdNot(String imei, UUID id);

    /**
     * Vehículos de un usuario.
     *
     * Se declara con @Query en vez de derivarlo del nombre porque el campo de la
     * entidad se llama id_usuario (snake_case), y el método derivado equivalente
     * tendría un nombre impresentable.
     *
     * Este método es el que sustituye a Usuario.getVehiculos(): la colección
     * @OneToMany estaba mapeada con mappedBy = "id_usuario" apuntando a un UUID
     * plano en lugar de a una asociación @ManyToOne, y además provocaba un N+1 al
     * serializarse con open-in-view activo.
     */
    @Query("SELECT v FROM Vehiculo v WHERE v.id_usuario = :idUsuario ORDER BY v.creadoEn DESC")
    List<Vehiculo> findByUsuarioId(@Param("idUsuario") UUID idUsuario);

    @Query("SELECT COUNT(v) FROM Vehiculo v WHERE v.id_usuario = :idUsuario")
    long countByUsuarioId(@Param("idUsuario") UUID idUsuario);

    /**
     * Devuelve al inventario (sin propietario) los vehículos de un usuario.
     * id_usuario es un UUID plano sin clave foránea: si no se hace esto antes de
     * borrar al usuario, sus vehículos quedan apuntando a alguien que no existe.
     */
    @Modifying
    @Query("UPDATE Vehiculo v SET v.id_usuario = NULL WHERE v.id_usuario = :idUsuario")
    int desasignarDeUsuario(@Param("idUsuario") UUID idUsuario);

    @Query("SELECT COUNT(v) FROM Vehiculo v WHERE v.activo = true")
    long contarActivos();

    @Query("SELECT COUNT(v) FROM Vehiculo v WHERE v.imei IS NOT NULL AND v.imei <> ''")
    long contarConImei();

    @Query("SELECT COUNT(v) FROM Vehiculo v WHERE v.id_usuario IS NULL")
    long contarSinDuenno();

    /** ¿Es este usuario el propietario del vehículo con ese IMEI? Para autorizar consultas GPS. */
    @Query("SELECT CASE WHEN COUNT(v) > 0 THEN true ELSE false END FROM Vehiculo v WHERE v.imei = :imei AND v.id_usuario = :idUsuario")
    boolean existePorImeiYUsuario(@Param("imei") String imei, @Param("idUsuario") UUID idUsuario);

    @Query("""
            SELECT v FROM Vehiculo v
            WHERE v.activo = true
              AND v.id_usuario IS NOT NULL
              AND (v.fechaVencimientoSoat IS NOT NULL OR v.fechaVencimientoTecnomecanica IS NOT NULL)
            """)
    List<Vehiculo> findVehiculosActivosConDocumentos();

    /** Listado del panel: búsqueda por placa, IMEI o modelo, con filtros. */
    @Query("""
            SELECT v FROM Vehiculo v
            WHERE (LOWER(v.placa)  LIKE LOWER(CONCAT('%', :busqueda, '%'))
                OR LOWER(v.modelo) LIKE LOWER(CONCAT('%', :busqueda, '%'))
                OR (v.imei IS NOT NULL AND LOWER(v.imei) LIKE LOWER(CONCAT('%', :busqueda, '%'))))
              AND (:activo    IS NULL OR v.activo     = :activo)
              AND (:idUsuario IS NULL OR v.id_usuario = :idUsuario)
            """)
    Page<Vehiculo> buscar(@Param("busqueda") String busqueda,
                          @Param("activo") Boolean activo,
                          @Param("idUsuario") UUID idUsuario,
                          Pageable pageable);
}
