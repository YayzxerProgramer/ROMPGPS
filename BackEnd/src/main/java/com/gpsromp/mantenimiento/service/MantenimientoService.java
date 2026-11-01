package com.gpsromp.mantenimiento.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gpsromp.common.exception.RecursoDuplicadoException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.mantenimiento.dto.CrearMantenimientoRequest;
import com.gpsromp.mantenimiento.model.Mantenimiento;
import com.gpsromp.mantenimiento.prediccion.CachePrediccion;
import com.gpsromp.mantenimiento.repository.MantenimientoRepository;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;

/**
 * Registro de mantenimientos de un vehículo.
 *
 * Sin @Cacheable a propósito: RedisConfig deshabilita el cacheo de nulos y los
 * métodos que devuelven Optional ya causaron un 500 en VehiculoService. La
 * caché de Redis va sobre la predicción (CachePrediccion), y aquí solo se
 * invalida cuando cambia el historial.
 *
 * La autorización (propietario o ADMIN) se resuelve en el controlador; aquí se
 * comprueba solo que el vehículo exista, porque vehiculoId no tiene clave foránea.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MantenimientoService {

    private final MantenimientoRepository mantenimientoRepository;
    private final VehiculoRepository vehiculoRepository;
    private final CachePrediccion cachePrediccion;

    public List<Mantenimiento> listar(UUID idVehiculo) {
        exigirVehiculo(idVehiculo);
        return mantenimientoRepository.findByVehiculoIdOrderByFechaDescCreadoEnDesc(idVehiculo);
    }

    /** El más reciente, o vacío si el vehículo nunca ha tenido mantenimiento. Lo usará la predicción. */
    public Optional<Mantenimiento> ultimo(UUID idVehiculo) {
        return mantenimientoRepository.findFirstByVehiculoIdOrderByFechaDescCreadoEnDesc(idVehiculo);
    }

    @Transactional
    public Mantenimiento registrar(UUID idVehiculo, CrearMantenimientoRequest peticion) {
        exigirVehiculo(idVehiculo);

        if (mantenimientoRepository.existsByVehiculoIdAndFechaAndTipo(
                idVehiculo, peticion.fecha(), peticion.tipo())) {
            throw new RecursoDuplicadoException(
                    "Ya hay un mantenimiento " + peticion.tipo() + " registrado el " + peticion.fecha());
        }

        Mantenimiento mantenimiento = Mantenimiento.builder()
                .vehiculoId(idVehiculo)
                .fecha(peticion.fecha())
                .tipo(peticion.tipo())
                .notas(vacioANull(peticion.notas()))
                .build();

        Mantenimiento guardado = mantenimientoRepository.save(mantenimiento);
        cachePrediccion.invalidar(idVehiculo);
        return guardado;
    }

    @Transactional
    public void eliminar(UUID idVehiculo, UUID idMantenimiento) {
        Mantenimiento mantenimiento = mantenimientoRepository
                .findByIdAndVehiculoId(idMantenimiento, idVehiculo)
                .orElseThrow(() -> new RecursoNoEncontradoException(
                        "No existe el mantenimiento " + idMantenimiento + " en el vehículo " + idVehiculo));
        mantenimientoRepository.delete(mantenimiento);
        cachePrediccion.invalidar(idVehiculo);
    }

    /** Lo llama VehiculoService.eliminar para no dejar mantenimientos huérfanos. */
    @Transactional
    public int eliminarDeVehiculo(UUID idVehiculo) {
        int borrados = mantenimientoRepository.borrarPorVehiculo(idVehiculo);
        cachePrediccion.invalidar(idVehiculo);
        return borrados;
    }

    private void exigirVehiculo(UUID idVehiculo) {
        if (!vehiculoRepository.existsById(idVehiculo)) {
            throw RecursoNoEncontradoException.vehiculo(idVehiculo);
        }
    }

    private String vacioANull(String valor) {
        return (valor == null || valor.isBlank()) ? null : valor.trim();
    }
}
