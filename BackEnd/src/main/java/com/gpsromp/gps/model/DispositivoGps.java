package com.gpsromp.gps.model;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Entidad telemática que representa el hardware físico del rastreador GPS y su línea celular (SIM Card).
 * Reside en MongoDB (Romp_Gps -> dispositivos_gps) de forma desacoplada del vehículo en PostgreSQL.
 */
@Document(collection = "dispositivos_gps")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispositivoGps {

    @Id
    private String id;

    @Indexed(unique = true)
    private String imei;

    @Field("numero_sim")
    private String numeroSim;

    @Builder.Default
    private String modelo = "GT06";

    private String operador; // "Claro", "Tigo", "Movistar", etc.

    @Builder.Default
    private Boolean activo = true;

    @Builder.Default
    @Field("creado_en")
    private Instant creadoEn = Instant.now();

    @Builder.Default
    @Field("actualizado_en")
    private Instant actualizadoEn = Instant.now();
}
