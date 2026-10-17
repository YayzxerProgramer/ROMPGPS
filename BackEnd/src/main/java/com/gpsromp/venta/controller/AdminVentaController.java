package com.gpsromp.venta.controller;

import com.gpsromp.common.dto.PaginaResponse;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.venta.dto.CambiarEstadoVentaRequest;
import com.gpsromp.venta.dto.CrearVentaRequest;
import com.gpsromp.venta.dto.EstadisticasVentasResponse;
import com.gpsromp.venta.dto.VentaResponse;
import com.gpsromp.venta.service.VentaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/admin/ventas")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminVentaController {

    private final VentaService ventaService;

    /**
     * Métricas y estadísticas de ventas para el panel de administración.
     */
    @GetMapping("/estadisticas")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EstadisticasVentasResponse> obtenerEstadisticas() {
        return ResponseEntity.ok(ventaService.obtenerEstadisticas());
    }

    /**
     * Listado paginado y filtrado de ventas.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PaginaResponse<VentaResponse>> listarVentas(
            @RequestParam(required = false) String busqueda,
            @RequestParam(required = false) PlanTipo plan,
            @RequestParam(required = false) String estado,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "15") int tamano,
            @RequestParam(defaultValue = "creadoEn") String ordenarPor,
            @RequestParam(defaultValue = "DESC") String direccion) {

        int tamanoAjustado = Math.max(1, Math.min(tamano, 100));
        Sort sort = "ASC".equalsIgnoreCase(direccion)
                ? Sort.by(ordenarPor).ascending()
                : Sort.by(ordenarPor).descending();

        Pageable pageable = PageRequest.of(pagina, tamanoAjustado, sort);
        Page<VentaResponse> resultado = ventaService.listarVentas(busqueda, plan, estado, pageable);

        return ResponseEntity.ok(PaginaResponse.de(resultado, v -> v));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VentaResponse> detalleVenta(@PathVariable UUID id) {
        return ResponseEntity.ok(ventaService.obtenerPorId(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VentaResponse> crearVenta(@Valid @RequestBody CrearVentaRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ventaService.crearVenta(req));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VentaResponse> cambiarEstado(
            @PathVariable UUID id,
            @Valid @RequestBody CambiarEstadoVentaRequest req) {
        return ResponseEntity.ok(ventaService.actualizarEstado(id, req.estado()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> eliminarVenta(@PathVariable UUID id) {
        ventaService.eliminarVenta(id);
        return ResponseEntity.noContent().build();
    }
}
