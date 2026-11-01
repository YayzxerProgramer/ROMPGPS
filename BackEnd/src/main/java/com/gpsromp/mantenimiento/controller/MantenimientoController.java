package com.gpsromp.mantenimiento.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gpsromp.mantenimiento.dto.CrearMantenimientoRequest;
import com.gpsromp.mantenimiento.dto.MantenimientoResponse;
import com.gpsromp.mantenimiento.service.MantenimientoService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Mantenimientos de un vehículo.
 *
 * Misma regla de acceso que VehiculoController: el propietario del vehículo o un
 * ADMIN. Sin ella, cualquier cuenta autenticada podría ver o falsear el historial
 * de mantenimiento de una flota ajena, y con él las predicciones.
 */
@RestController
@RequestMapping("/vehiculo/{idVehiculo}/mantenimientos")
@RequiredArgsConstructor
public class MantenimientoController {

    private final MantenimientoService mantenimientoService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#idVehiculo, authentication)")
    public ResponseEntity<List<MantenimientoResponse>> listar(@PathVariable UUID idVehiculo) {
        return ResponseEntity.ok(mantenimientoService.listar(idVehiculo).stream()
                .map(MantenimientoResponse::desde)
                .toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#idVehiculo, authentication)")
    public ResponseEntity<MantenimientoResponse> registrar(
            @PathVariable UUID idVehiculo,
            @Valid @RequestBody CrearMantenimientoRequest peticion) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(MantenimientoResponse.desde(mantenimientoService.registrar(idVehiculo, peticion)));
    }

    @DeleteMapping("/{idMantenimiento}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#idVehiculo, authentication)")
    public ResponseEntity<Void> eliminar(
            @PathVariable UUID idVehiculo,
            @PathVariable UUID idMantenimiento) {

        mantenimientoService.eliminar(idVehiculo, idMantenimiento);
        return ResponseEntity.noContent().build();
    }
}
