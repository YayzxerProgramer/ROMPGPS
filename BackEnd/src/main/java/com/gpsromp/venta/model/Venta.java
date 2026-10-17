package com.gpsromp.venta.model;

import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Usuario;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entidad de Ventas.
 *
 * Registra cada suscripción o venta realizada en la plataforma,
 * vinculada a los planes de la landing page (PERSONAL, PRO, ENTERPRISE).
 */
@Entity
@Table(name = "ventas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venta implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @Column(nullable = false)
    private String clienteNombre;

    @Column(nullable = false)
    private String clienteCorreo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PlanTipo plan;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String periodo = "MENSUAL"; // MENSUAL, ANUAL

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String estado = "APROBADO"; // APROBADO, PENDIENTE, CANCELADO

    @Column(length = 50)
    @Builder.Default
    private String metodoPago = "WOMPI"; // WOMPI, NEQUI, PSE, TARJETA, TRANSFERENCIA, EFECTIVO

    @Column(unique = true, nullable = false, length = 100)
    private String referencia; // ej. VEN-172884..., SUB-...

    @Column(length = 500)
    private String notas;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime creadoEn;

    @UpdateTimestamp
    private LocalDateTime actualizadoEn;
}
