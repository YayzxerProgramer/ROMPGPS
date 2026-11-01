package com.gpsromp.mantenimiento.model;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Un mantenimiento realizado a un vehículo.
 *
 * Es la fuente de la variable objetivo del modelo predictivo: los kilómetros
 * que le faltan a un vehículo para su próximo mantenimiento se miden contra
 * el último registro de esta tabla.
 *
 * No guarda el odómetro del tablero a propósito: los dispositivos GT06 no lo
 * entregan y pedírselo al usuario añade fricción y errores de digitación. Los
 * kilómetros se calculan a partir de las posiciones GPS posteriores a {@link #fecha}.
 *
 * vehiculoId es un UUID plano, igual que Vehiculo.id_usuario: no hay clave
 * foránea, así que MantenimientoService comprueba que el vehículo exista y
 * VehiculoService debe borrar sus mantenimientos al eliminar un vehículo.
 */
@Entity
@Table(name = "mantenimientos",
        indexes = @Index(name = "idx_mantenimiento_vehiculo_fecha", columnList = "vehiculo_id, fecha"))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Mantenimiento implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vehiculo_id", nullable = false)
    private UUID vehiculoId;

    /** Día en que se hizo el mantenimiento. Solo fecha: la hora no aporta al modelo. */
    @Column(nullable = false)
    private LocalDate fecha;

    /** PREVENTIVO o CORRECTIVO. Lo valida CrearMantenimientoRequest con @Pattern. */
    @Column(nullable = false, length = 12)
    private String tipo;

    @Column(length = 500)
    private String notas;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime creadoEn;
}
