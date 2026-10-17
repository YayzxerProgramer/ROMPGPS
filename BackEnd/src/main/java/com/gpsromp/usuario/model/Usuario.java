package com.gpsromp.usuario.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import java.io.Serializable;

@Entity
@Table(name = "Usuarios")
@Data
@NoArgsConstructor
public class Usuario implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String nombre;

    private String apellido;

    @Column(unique = true, nullable = false)
    private String usuario;

    @JsonIgnore
    private String contrasena;

    @Column(unique = true, nullable = false)
    private String correo;

    private String telefono;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Rol rol = Rol.USUARIO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PlanTipo plan = PlanTipo.PERSONAL;

    @Column(nullable = false)
    private Boolean activo = true;

    private String imagenUrl;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime creadoEn;

    @UpdateTimestamp
    private LocalDateTime actualizadoEn;
}
