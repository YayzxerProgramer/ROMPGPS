package com.gpsromp.vehiculo.service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoDuplicadoException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.config.SeguridadService;
import com.gpsromp.mantenimiento.service.MantenimientoService;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.dto.ActualizarVehiculoRequest;
import com.gpsromp.vehiculo.dto.CrearVehiculoRequest;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;

/**
 * Lógica de vehículos.
 *
 * Se retiraron los @Cacheable que había sobre métodos que devuelven Optional:
 * RedisConfig llama a disableCachingNullValues(), así que al consultar un id,
 * placa o IMEI inexistente Spring desenvolvía el Optional.empty() a null,
 * intentaba cachearlo y lanzaba IllegalArgumentException, devolviendo 500 en
 * lugar de 404. Los cuatro métodos compartían además la misma caché "vehiculos"
 * con claves de tipos distintos (id, placa, imei), de forma que una placa que
 * coincidiera con un IMEI podía devolver la entrada equivocada.
 *
 * También se unifica @Transactional en la variante de Spring: antes esta clase
 * usaba jakarta.transaction.Transactional, que no admite readOnly.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VehiculoService {

    private final VehiculoRepository vehiculoRepository;
    private final UsuarioRepository usuarioRepository;
    private final MantenimientoService mantenimientoService;
    private final SeguridadService seguridadService;

    // ---------------------------------------------------------------- consultas

    public Page<Vehiculo> buscar(String busqueda, Boolean activo, UUID idUsuario, Pageable pageable) {
        String texto = (busqueda == null) ? "" : busqueda.trim();
        return vehiculoRepository.buscar(texto, activo, idUsuario, pageable);
    }

    public List<Vehiculo> obtenerTodos() {
        return vehiculoRepository.findAll();
    }

    /** Reemplaza a Usuario.getVehiculos(): una consulta directa, sin colección LAZY ni N+1. */
    public List<Vehiculo> obtenerPorUsuario(UUID idUsuario) {
        return vehiculoRepository.findByUsuarioId(idUsuario);
    }

    public Vehiculo obtenerPorIdOFallar(UUID id) {
        return vehiculoRepository.findById(id)
                .orElseThrow(() -> RecursoNoEncontradoException.vehiculo(id));
    }

    public Optional<Vehiculo> obtenerPorId(UUID id) {
        return vehiculoRepository.findById(id);
    }

    public Optional<Vehiculo> obtenerPorPlaca(String placa) {
        return vehiculoRepository.findByPlaca(placa);
    }

    public Optional<Vehiculo> obtenerPorImei(String imei) {
        return vehiculoRepository.findByImei(imei);
    }

    public boolean esPropietario(UUID idVehiculo, UUID idUsuario) {
        return vehiculoRepository.findById(idVehiculo)
                .map(v -> idUsuario.equals(v.getId_usuario()))
                .orElse(false);
    }

    public boolean esPropietarioDelImei(String imei, UUID idUsuario) {
        return vehiculoRepository.existePorImeiYUsuario(imei, idUsuario);
    }

    public long contarTodos() {
        return vehiculoRepository.count();
    }

    public long contarActivos() {
        return vehiculoRepository.contarActivos();
    }

    public long contarConImei() {
        return vehiculoRepository.contarConImei();
    }

    public long contarSinDuenno() {
        return vehiculoRepository.contarSinDuenno();
    }

    // ------------------------------------------------------------- mutaciones

    @Transactional
    public Vehiculo crear(CrearVehiculoRequest peticion) {
        String placa = peticion.placa().trim().toUpperCase();
        String imei = vacioANull(peticion.imei());

        // Regla de seguridad: solo un administrador puede asignar el IMEI de un GPS
        if (imei != null && !seguridadService.esAdminActual()) {
            throw new OperacionNoPermitidaException("Solo un administrador puede asignar o vincular el IMEI de un GPS a un vehículo");
        }

        if (vehiculoRepository.existsByPlaca(placa)) {
            throw new RecursoDuplicadoException("Ya existe un vehículo con la placa " + placa);
        }
        if (imei != null && vehiculoRepository.existsByImei(imei)) {
            throw new RecursoDuplicadoException("Ya existe un vehículo con el IMEI " + imei);
        }
        if (peticion.idUsuario() != null && !usuarioRepository.existsById(peticion.idUsuario())) {
            throw RecursoNoEncontradoException.usuario(peticion.idUsuario());
        }

        Vehiculo vehiculo = Vehiculo.builder()
                .placa(placa)
                .imei(imei)
                .modelo(peticion.modelo().trim())
                .tipo(peticion.tipo())
                .activo(peticion.activo() == null || peticion.activo())
                .id_usuario(peticion.idUsuario())
                .build();

        return vehiculoRepository.save(vehiculo);
    }

    /**
     * Patch: los campos null se dejan como estaban.
     *
     * La versión anterior asignaba los seis campos sin comprobar null, así que un
     * PUT parcial borraba el IMEI y desasignaba el vehículo de su propietario.
     */
    @Transactional
    public Vehiculo actualizar(UUID id, ActualizarVehiculoRequest peticion) {
        Vehiculo vehiculo = obtenerPorIdOFallar(id);

        if (peticion.placa() != null) {
            String placa = peticion.placa().trim().toUpperCase();
            if (!placa.equals(vehiculo.getPlaca())
                    && vehiculoRepository.existsByPlacaAndIdNot(placa, id)) {
                throw new RecursoDuplicadoException("Ya existe un vehículo con la placa " + placa);
            }
            vehiculo.setPlaca(placa);
        }
        if (peticion.imei() != null) {
            String imei = vacioANull(peticion.imei());
            // Regla de seguridad: solo un administrador puede alterar el IMEI
            if (!Objects.equals(imei, vehiculo.getImei()) && !seguridadService.esAdminActual()) {
                throw new OperacionNoPermitidaException("Solo un administrador puede modificar el IMEI del GPS");
            }
            if (imei != null && !imei.equals(vehiculo.getImei())
                    && vehiculoRepository.existsByImeiAndIdNot(imei, id)) {
                throw new RecursoDuplicadoException("Ya existe un vehículo con el IMEI " + imei);
            }
            vehiculo.setImei(imei);
        }
        if (peticion.modelo() != null) {
            vehiculo.setModelo(peticion.modelo().trim());
        }
        if (peticion.tipo() != null) {
            vehiculo.setTipo(peticion.tipo());
        }
        if (peticion.activo() != null) {
            vehiculo.setActivo(peticion.activo());
        }

        return vehiculoRepository.save(vehiculo);
    }

    /**
     * Reasigna el propietario. Un idUsuario null desasigna, que es válido.
     * Como no hay clave foránea, se comprueba aquí que el usuario exista.
     */
    @Transactional
    public Vehiculo asignarUsuario(UUID idVehiculo, UUID idUsuario) {
        Vehiculo vehiculo = obtenerPorIdOFallar(idVehiculo);

        if (idUsuario != null && !usuarioRepository.existsById(idUsuario)) {
            throw RecursoNoEncontradoException.usuario(idUsuario);
        }

        vehiculo.setId_usuario(idUsuario);
        return vehiculoRepository.save(vehiculo);
    }

    @Transactional
    public Vehiculo cambiarEstado(UUID id) {
        Vehiculo vehiculo = obtenerPorIdOFallar(id);
        vehiculo.setActivo(!Boolean.TRUE.equals(vehiculo.getActivo()));
        return vehiculoRepository.save(vehiculo);
    }

    @Transactional
    public void eliminar(UUID id) {
        Vehiculo vehiculo = obtenerPorIdOFallar(id);
        mantenimientoService.eliminarDeVehiculo(id);
        vehiculoRepository.delete(vehiculo);
    }

    private String vacioANull(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }
}
