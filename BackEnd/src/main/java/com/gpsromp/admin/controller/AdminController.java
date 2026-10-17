package com.gpsromp.admin.controller;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.gpsromp.admin.dto.ResumenAdminResponse;
import com.gpsromp.admin.dto.VehiculoAdminResponse;
import com.gpsromp.admin.service.AdminVehiculoService;
import com.gpsromp.common.dto.PaginaResponse;
import com.gpsromp.usuario.dto.*;
import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.service.UsuarioService;
import com.gpsromp.vehiculo.dto.AsignarVehiculoRequest;
import com.gpsromp.vehiculo.dto.VehiculoMapper;
import com.gpsromp.vehiculo.dto.VehiculoResponse;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.service.VehiculoService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * Panel administrativo.
 *
 * Se aísla en /admin en lugar de anotar los controladores existentes por dos
 * razones. Primera: el frontend actual ya consume /usuario/** y /vehiculo/** y
 * no debe romperse. Segunda: separar la superficie de administración permite
 * protegerla también a nivel de ruta en SecurityConfig (/admin/** exige ADMIN),
 * de modo que si alguien añade aquí un método y olvida el @PreAuthorize, la
 * cadena de filtros lo sigue cubriendo.
 *
 * Toda la clase es hasRole('ADMIN'). Las anotaciones por método están además
 * declaradas de forma explícita para que la regla se lea junto al endpoint.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final UsuarioService usuarioService;
    private final VehiculoService vehiculoService;
    private final AdminVehiculoService adminVehiculoService;

    private static final int TAMANO_MAXIMO_PAGINA = 100;

    /**
     * Campos por los que se permite ordenar.
     *
     * Es una lista blanca, no una comodidad: Sort.by() con un nombre de propiedad
     * que no existe en la entidad lanza PropertyReferenceException y el endpoint
     * respondería 500 ante un simple ?ordenarPor=loQueSea.
     */
    private static final Set<String> ORDEN_USUARIOS = Set.of(
            "creadoEn", "actualizadoEn", "nombre", "apellido", "usuario", "correo", "rol", "activo");

    private static final Set<String> ORDEN_VEHICULOS = Set.of(
            "creadoEn", "actualizadoEn", "placa", "imei", "modelo", "tipo", "activo");

    // ============================================================== resumen

    /** Métricas de las stat cards del panel. Solo COUNT, sin traerse las tablas. */
    @GetMapping("/resumen")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ResumenAdminResponse> resumen() {
        return ResponseEntity.ok(new ResumenAdminResponse(
                usuarioService.contarTodos(),
                usuarioService.contarActivos(),
                usuarioService.contarPorRol(Rol.ADMINISTRADOR),
                vehiculoService.contarTodos(),
                vehiculoService.contarActivos(),
                vehiculoService.contarConImei(),
                vehiculoService.contarSinDuenno()));
    }

    // ============================================================= usuarios

    /**
     * Listado de usuarios paginado, filtrado y ordenado.
     *
     * Sustituye a GET /usuario, que hacía findAll() sin paginación y serializaba
     * la colección LAZY de vehículos, provocando una consulta extra por usuario.
     *
     * Ejemplo: GET /admin/usuarios?busqueda=ana&rol=USER&activo=true&pagina=0&tamano=20&ordenarPor=creadoEn&direccion=DESC
     */
    @GetMapping("/usuarios")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PaginaResponse<UsuarioResponse>> listarUsuarios(
            @RequestParam(required = false) String busqueda,
            @RequestParam(required = false) Rol rol,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano,
            @RequestParam(defaultValue = "creadoEn") String ordenarPor,
            @RequestParam(defaultValue = "DESC") String direccion) {

        Pageable pageable = construirPageable(pagina, tamano, ordenarPor, direccion, ORDEN_USUARIOS);
        Page<Usuario> resultado = usuarioService.buscar(busqueda, rol, activo, pageable);

        return ResponseEntity.ok(PaginaResponse.de(resultado, UsuarioMapper::aResponse));
    }

    @GetMapping("/usuarios/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> detalleUsuario(@PathVariable UUID id) {
        return ResponseEntity.ok(
                UsuarioMapper.aResponse(usuarioService.obtenerPorIdOFallar(id)));
    }

    /** Alta con rol. Única vía legítima para crear un usuario que no sea USER. */
    @PostMapping("/usuarios")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> crearUsuario(
            @Valid @RequestBody CrearUsuarioAdminRequest peticion) {

        Usuario creado = usuarioService.crearComoAdmin(peticion);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(UsuarioMapper.aResponse(creado));
    }

    @PutMapping("/usuarios/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> actualizarUsuario(
            @PathVariable UUID id,
            @Valid @RequestBody ActualizarUsuarioRequest peticion) {

        return ResponseEntity.ok(
                UsuarioMapper.aResponse(usuarioService.actualizar(id, peticion)));
    }

    /**
     * Cambio de rol. Operación que no existía en la API.
     *
     * El servicio bloquea que un administrador se degrade a sí mismo y que se
     * degrade al último ADMIN que queda en el sistema.
     */
    @PatchMapping("/usuarios/{id}/rol")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> cambiarRol(
            @PathVariable UUID id,
            @Valid @RequestBody CambiarRolRequest peticion,
            Authentication auth) {

        Usuario actualizado = usuarioService.cambiarRol(id, peticion.rol(), auth.getName());
        return ResponseEntity.ok(UsuarioMapper.aResponse(actualizado));
    }

    /**
     * Cambio de plan desde el panel administrativo.
     */
    @PatchMapping("/usuarios/{id}/plan")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> cambiarPlan(
            @PathVariable UUID id,
            @Valid @RequestBody CambiarPlanRequest peticion) {

        Usuario actualizado = usuarioService.cambiarPlan(id, peticion.plan());
        return ResponseEntity.ok(UsuarioMapper.aResponse(actualizado));
    }

    /** Activa o desactiva. Desactivar corta el acceso en la siguiente petición. */
    @PatchMapping("/usuarios/{id}/estado")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UsuarioResponse> cambiarEstadoUsuario(
            @PathVariable UUID id, Authentication auth) {

        return ResponseEntity.ok(
                UsuarioMapper.aResponse(usuarioService.cambiarEstado(id, auth.getName())));
    }

    /** Reseteo de contraseña por un administrador: no exige la contraseña actual. */
    @PatchMapping("/usuarios/{id}/contrasena")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetearContrasena(
            @PathVariable UUID id,
            @Valid @RequestBody CambiarContrasenaRequest peticion) {

        usuarioService.cambiarContrasena(id, null, peticion.nuevaContrasena(), true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/usuarios/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> eliminarUsuario(@PathVariable UUID id, Authentication auth) {
        usuarioService.eliminar(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    /** Vehículos de un usuario concreto. */
    @GetMapping("/usuarios/{id}/vehiculos")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<VehiculoResponse>> vehiculosDelUsuario(@PathVariable UUID id) {
        usuarioService.obtenerPorIdOFallar(id);
        List<VehiculoResponse> vehiculos = vehiculoService.obtenerPorUsuario(id).stream()
                .map(VehiculoMapper::aResponse)
                .toList();
        return ResponseEntity.ok(vehiculos);
    }

    // ============================================================ vehículos

    /** Listado de vehículos paginado, filtrado y enriquecido con cálculos logísticos y telemetría. */
    @GetMapping("/vehiculos")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PaginaResponse<VehiculoAdminResponse>> listarVehiculos(
            @RequestParam(required = false) String busqueda,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(required = false, name = "id_usuario") UUID idUsuario,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "20") int tamano,
            @RequestParam(defaultValue = "creadoEn") String ordenarPor,
            @RequestParam(defaultValue = "DESC") String direccion) {

        Pageable pageable = construirPageable(pagina, tamano, ordenarPor, direccion, ORDEN_VEHICULOS);
        Page<VehiculoAdminResponse> resultado = adminVehiculoService.buscar(busqueda, activo, idUsuario, pageable);

        return ResponseEntity.ok(PaginaResponse.de(resultado, v -> v));
    }

    @GetMapping("/vehiculos/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehiculoAdminResponse> detalleVehiculo(@PathVariable UUID id) {
        return ResponseEntity.ok(adminVehiculoService.obtenerPorIdOFallar(id));
    }

    /**
     * Asigna o desasigna el propietario de un vehículo.
     * Un id_usuario null desasigna (vehículo en stock, sin cliente).
     */
    @PutMapping("/vehiculos/{id}/usuario")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehiculoAdminResponse> asignarVehiculo(
            @PathVariable UUID id,
            @RequestBody AsignarVehiculoRequest peticion) {

        vehiculoService.asignarUsuario(id, peticion.idUsuario());
        return ResponseEntity.ok(adminVehiculoService.obtenerPorIdOFallar(id));
    }

    @PatchMapping("/vehiculos/{id}/estado")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<VehiculoAdminResponse> cambiarEstadoVehiculo(@PathVariable UUID id) {
        vehiculoService.cambiarEstado(id);
        return ResponseEntity.ok(adminVehiculoService.obtenerPorIdOFallar(id));
    }

    @DeleteMapping("/vehiculos/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> eliminarVehiculo(@PathVariable UUID id) {
        vehiculoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    // ============================================================== privados

    /**
     * Construye el Pageable acotando el tamaño de página.
     * Sin el tope, un cliente podría pedir tamano=1000000 y forzar al servidor a
     * materializar la tabla entera, que es justo lo que la paginación evita.
     */
    private Pageable construirPageable(int pagina, int tamano, String ordenarPor,
                                       String direccion, Set<String> camposPermitidos) {
        int paginaSegura = Math.max(pagina, 0);
        int tamanoSeguro = Math.min(Math.max(tamano, 1), TAMANO_MAXIMO_PAGINA);

        String campo = camposPermitidos.contains(ordenarPor) ? ordenarPor : "creadoEn";

        Sort.Direction dir = "ASC".equalsIgnoreCase(direccion)
                ? Sort.Direction.ASC
                : Sort.Direction.DESC;

        return PageRequest.of(paginaSegura, tamanoSeguro, Sort.by(dir, campo));
    }
}
