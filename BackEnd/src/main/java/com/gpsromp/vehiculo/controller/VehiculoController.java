package com.gpsromp.vehiculo.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.vehiculo.dto.ActualizarDocumentosRequest;
import com.gpsromp.vehiculo.dto.ActualizarVehiculoRequest;
import com.gpsromp.vehiculo.dto.CrearVehiculoRequest;
import com.gpsromp.vehiculo.dto.VehiculoMapper;
import com.gpsromp.vehiculo.dto.VehiculoResponse;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.service.AlertaDocumentosVehiculoService;
import com.gpsromp.vehiculo.service.VehiculoService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Vehículos, desde la perspectiva del usuario final.
 *
 * Antes todos estos endpoints eran accesibles para cualquier cuenta autenticada
 * sin comprobar propiedad: se podían listar, editar y borrar los vehículos de
 * toda la flota, y consultar cualquiera por IMEI. Ahora cada operación exige ser
 * el propietario o ADMIN.
 *
 * El listado completo y la reasignación de propietario viven en /admin/vehiculos.
 */
@RestController
@RequestMapping("/vehiculo")
@RequiredArgsConstructor
public class VehiculoController {

    private final VehiculoService vehiculoService;
    private final AlertaDocumentosVehiculoService alertaDocumentosVehiculoService;

    /** Listado completo. Solo ADMIN; el panel debe usar /admin/vehiculos, que pagina. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<VehiculoResponse>> obtenerTodosLosVehiculos() {
        return ResponseEntity.ok(vehiculoService.obtenerTodos().stream()
                .map(VehiculoMapper::aResponse)
                .toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#id, authentication)")
    public ResponseEntity<VehiculoResponse> obtenerVehiculoPorId(@PathVariable UUID id) {
        return ResponseEntity.ok(
                VehiculoMapper.aResponse(vehiculoService.obtenerPorIdOFallar(id)));
    }

    @GetMapping("/placa/{placa}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehiculoResponse> obtenerVehiculoPorPlaca(@PathVariable String placa) {
        Vehiculo vehiculo = vehiculoService.obtenerPorPlaca(placa)
                .orElseThrow(() -> RecursoNoEncontradoException.vehiculo(placa));
        return ResponseEntity.ok(VehiculoMapper.aResponse(vehiculo));
    }

    /**
     * Consulta por IMEI. Restringida al propietario porque el IMEI es la clave
     * con la que se rastrea un vehículo: exponerla a cualquier autenticado
     * permitía enumerar y seguir flotas ajenas.
     */
    @GetMapping("/imei/{imei}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiImei(#imei, authentication)")
    public ResponseEntity<VehiculoResponse> obtenerVehiculoPorImei(@PathVariable String imei) {
        Vehiculo vehiculo = vehiculoService.obtenerPorImei(imei)
                .orElseThrow(() -> RecursoNoEncontradoException.vehiculo(imei));
        return ResponseEntity.ok(VehiculoMapper.aResponse(vehiculo));
    }

    /**
     * Alta de vehículo.
     *
     * Un usuario normal solo puede registrarlo a su propio nombre; un ADMIN puede
     * asignarlo a quien quiera. Sin esta regla, cualquiera podía dar de alta
     * vehículos en la cuenta de otra persona.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiUsuario(#peticion.idUsuario(), authentication)")
    public ResponseEntity<VehiculoResponse> crearVehiculo(
            @Valid @RequestBody CrearVehiculoRequest peticion) {

        Vehiculo creado = vehiculoService.crear(peticion);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(VehiculoMapper.aResponse(creado));
    }

    /** Patch: los campos ausentes se conservan. No permite reasignar propietario. */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#id, authentication)")
    public ResponseEntity<VehiculoResponse> actualizarVehiculo(
            @PathVariable UUID id,
            @Valid @RequestBody ActualizarVehiculoRequest peticion) {

        return ResponseEntity.ok(
                VehiculoMapper.aResponse(vehiculoService.actualizar(id, peticion)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#id, authentication)")
    public ResponseEntity<Void> eliminarVehiculo(@PathVariable UUID id) {
        vehiculoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/cambiar-estado")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#id, authentication)")
    public ResponseEntity<VehiculoResponse> cambiarEstadoVehiculo(@PathVariable UUID id) {
        return ResponseEntity.ok(
                VehiculoMapper.aResponse(vehiculoService.cambiarEstado(id)));
    }

    /**
     * Actualiza las fechas de vencimiento de documentos (SOAT y Tecnomecánica).
     * Accesible para el propietario del vehículo o administradores.
     */
    @PatchMapping("/{id}/documentos")
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiVehiculo(#id, authentication)")
    public ResponseEntity<VehiculoResponse> actualizarDocumentos(
            @PathVariable UUID id,
            @RequestBody ActualizarDocumentosRequest peticion) {

        return ResponseEntity.ok(
                VehiculoMapper.aResponse(
                        vehiculoService.actualizarDocumentos(
                                id,
                                peticion.fechaVencimientoSoat(),
                                peticion.fechaVencimientoTecnomecanica())));
    }

    /**
     * Dispara manualmente la comprobación de alertas de vencimiento.
     * Restringido a administradores (útil para auditoría y pruebas del webhook n8n).
     */
    @PostMapping("/alertas-documentos/ejecutar")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> ejecutarRevisionDocumentos() {
        int enviadas = alertaDocumentosVehiculoService.ejecutarRevisionManual();
        return ResponseEntity.ok(Map.of(
                "mensaje", "Revisión manual de documentos ejecutada exitosamente",
                "alertasDespachadas", enviadas
        ));
    }
}
