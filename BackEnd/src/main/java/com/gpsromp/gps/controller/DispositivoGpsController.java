package com.gpsromp.gps.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gpsromp.gps.dto.DispositivoGpsDto;
import com.gpsromp.gps.dto.GuardarDispositivoGpsRequest;
import com.gpsromp.gps.service.DispositivoGpsService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Controlador administrativo para la gestión de dispositivos GPS y sus SIM Cards en MongoDB.
 * Exclusivo para administradores: ningún usuario estándar puede consultar ni modificar líneas celulares de rastreadores.
 */
@RestController
@RequestMapping("/admin/gps/dispositivos")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DispositivoGpsController {

    private final DispositivoGpsService dispositivoGpsService;

    @GetMapping
    public ResponseEntity<List<DispositivoGpsDto>> obtenerTodos() {
        return ResponseEntity.ok(dispositivoGpsService.obtenerTodos());
    }

    @GetMapping("/{imei}")
    public ResponseEntity<DispositivoGpsDto> obtenerPorImei(@PathVariable String imei) {
        return ResponseEntity.ok(dispositivoGpsService.obtenerPorImeiOFallar(imei));
    }

    @PostMapping
    public ResponseEntity<DispositivoGpsDto> crearOActualizar(@Valid @RequestBody GuardarDispositivoGpsRequest request) {
        DispositivoGpsDto dto = dispositivoGpsService.guardarOActualizar(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PutMapping("/{imei}")
    public ResponseEntity<DispositivoGpsDto> actualizarPorImei(
            @PathVariable String imei,
            @RequestBody GuardarDispositivoGpsRequest request) {
        GuardarDispositivoGpsRequest peticionFinal = new GuardarDispositivoGpsRequest(
                imei,
                request.numeroSim(),
                request.modelo(),
                request.operador(),
                request.activo()
        );
        return ResponseEntity.ok(dispositivoGpsService.guardarOActualizar(peticionFinal));
    }

    @DeleteMapping("/{imei}")
    public ResponseEntity<Void> eliminar(@PathVariable String imei) {
        dispositivoGpsService.eliminarPorImei(imei);
        return ResponseEntity.noContent().build();
    }
}
