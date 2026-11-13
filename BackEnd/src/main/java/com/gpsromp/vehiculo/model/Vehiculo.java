package com.gpsromp.vehiculo.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import java.io.Serializable;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;

@Entity
@Table(name = "Vehiculos")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vehiculo implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @NonNull
    @Column(unique = true, nullable = false, length = 6)
    private String placa;

    @Column(unique = true, nullable = true)
    private String imei;

    @NonNull
    private String modelo;

    /** MOTO o CARRO. Lo valida CrearVehiculoRequest con @Pattern. */
    @NonNull
    private String tipo;

    @Builder.Default
    private Boolean activo = true;

    /**
     * Propietario. Es un UUID plano, no una asociación @ManyToOne, así que no hay
     * clave foránea que garantice que el usuario existe: esa comprobación la hace
     * VehiculoService al asignar.
     *
     * El nombre del campo se conserva en snake_case porque la clave JSON
     * id_usuario es la que ya envía y lee PanelVehiculo.jsx.
     */
    @Column(name = "usuario_id")
    private UUID id_usuario;

    /** Fecha de vencimiento del SOAT (Seguro Obligatorio). */
    @Column(name = "fecha_vencimiento_soat")
    private LocalDate fechaVencimientoSoat;

    /** Fecha de vencimiento de la Revisión Técnico-Mecánica (RTM). */
    @Column(name = "fecha_vencimiento_tecnomecanica")
    private LocalDate fechaVencimientoTecnomecanica;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime creadoEn;

    @UpdateTimestamp
    private LocalDateTime actualizadoEn;
}
