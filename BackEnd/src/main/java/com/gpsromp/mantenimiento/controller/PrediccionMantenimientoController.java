package com.gpsromp.mantenimiento.controller;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gpsromp.mantenimiento.dto.PrediccionMantenimientoResponse;
import com.gpsromp.mantenimiento.service.PrediccionMantenimientoService;

import lombok.RequiredArgsConstructor;

/** Predicción de mantenimiento. Mismo acceso que el resto: propietario o ADMIN. */
@RestController
@RequestMapping("/vehiculo/{idVehiculo}/prediccion-mantenimiento")
@RequiredArgsConstructor
public class PrediccionMantenimientoController {

    private final PrediccionMantenimientoService servicio;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#idVehiculo, authentication)")
    public ResponseEntity<PrediccionMantenimientoResponse> obtener(@PathVariable UUID idVehiculo) {
        return ResponseEntity.ok(servicio.predecir(idVehiculo));
    }
}
