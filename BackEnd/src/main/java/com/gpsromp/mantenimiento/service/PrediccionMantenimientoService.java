package com.gpsromp.mantenimiento.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.gps.model.GPSData;
import com.gpsromp.mantenimiento.dto.PrediccionMantenimientoResponse;
import com.gpsromp.mantenimiento.model.Mantenimiento;
import com.gpsromp.mantenimiento.prediccion.AcumuladorCiclo;
import com.gpsromp.mantenimiento.prediccion.CachePrediccion;
import com.gpsromp.mantenimiento.prediccion.ClienteMl;
import com.gpsromp.mantenimiento.prediccion.RespuestaMl;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Orquesta la predicción: último mantenimiento (Postgres) -> posiciones GPS
 * desde esa fecha (Mongo, en streaming) -> variables -> ml-service -> caché.
 *
 * Sin @Transactional a propósito: recorrer Mongo y llamar por HTTP no debe
 * mantener abierta una conexión de Postgres.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PrediccionMantenimientoService {

    /** Las fechas de mantenimiento son días de calendario; se interpretan en hora de Colombia. */
    private static final ZoneId ZONA = ZoneId.of("America/Bogota");

    private final VehiculoRepository vehiculoRepository;
    private final MantenimientoService mantenimientoService;
    private final MongoTemplate mongoTemplate;
    private final ClienteMl clienteMl;
    private final CachePrediccion cache;

    /**
     * Índice (imei, registrado_en): la consulta filtra por IMEI y ordena por
     * fecha. Con los dos índices sueltos que ya existen, MongoDB ordenaría en
     * memoria y puede fallar con muchas posiciones. Es idempotente.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void asegurarIndice() {
        try {
            mongoTemplate.indexOps(GPSData.class).ensureIndex(
                    new Index().on("imei", Sort.Direction.ASC).on("registrado_en", Sort.Direction.ASC));
        } catch (Exception e) {
            log.warn("No se pudo crear el índice (imei, registrado_en) de gps_data: {}", e.getMessage());
        }
    }

    public PrediccionMantenimientoResponse predecir(UUID idVehiculo) {
        Vehiculo vehiculo = vehiculoRepository.findById(idVehiculo)
                .orElseThrow(() -> RecursoNoEncontradoException.vehiculo(idVehiculo));

        Optional<PrediccionMantenimientoResponse> enCache = cache.leer(idVehiculo);
        if (enCache.isPresent()) return enCache.get();

        Optional<Mantenimiento> ultimo = mantenimientoService.ultimo(idVehiculo);
        if (ultimo.isEmpty()) {
            return PrediccionMantenimientoResponse.sinEstimacion("SIN_MANTENIMIENTO",
                    "Registra el último mantenimiento para poder estimar el siguiente.", null);
        }
        Mantenimiento mant = ultimo.get();

        String imei = vehiculo.getImei();
        if (imei == null || imei.isBlank()) {
            return PrediccionMantenimientoResponse.sinEstimacion("SIN_DATOS_GPS",
                    "El vehículo no tiene un GPS asociado (IMEI).", mant.getFecha());
        }

        Instant ahora = Instant.now();
        LocalDate hoy = LocalDate.now(ZONA);
        AcumuladorCiclo acumulador = new AcumuladorCiclo(mant.getFecha(), ahora, ZONA);

        Query consulta = new Query(Criteria.where("imei").is(imei)
                .and("registradoEn").gte(acumulador.inicioCiclo()))
                .with(Sort.by(Sort.Direction.ASC, "registradoEn"));
        consulta.fields().include("registradoEn").include("latitud").include("longitud")
                .include("velocidad").include("gpsValido");

        try (Stream<GPSData> posiciones = mongoTemplate.stream(consulta, GPSData.class)) {
            posiciones.forEach(p -> acumulador.agregar(
                    p.getRegistradoEn(), p.getLatitud(), p.getLongitud(), p.getVelocidad(), p.isGpsValido()));
        }

        int numMantenimientos = mantenimientoService.listar(idVehiculo).size();
        AcumuladorCiclo.Resultado resultado = acumulador.calcular(
                vehiculo.getTipo(), mant.getTipo(), numMantenimientos, mant.getFecha(), hoy);

        if (!resultado.hayDatos()) {
            return PrediccionMantenimientoResponse.sinEstimacion("SIN_DATOS_GPS",
                    resultado.motivoSinDatos(), mant.getFecha());
        }

        Optional<RespuestaMl> respuesta = clienteMl.predecir(resultado.caracteristicas());
        if (respuesta.isEmpty()) {
            return PrediccionMantenimientoResponse.sinEstimacion("SERVICIO_NO_DISPONIBLE",
                    "El servicio de predicción no está disponible en este momento.", mant.getFecha());
        }

        RespuestaMl r = respuesta.get();
        PrediccionMantenimientoResponse prediccion = new PrediccionMantenimientoResponse(
                "OK",
                resultado.avisoIncompleto(),
                r.kmRestantes(),
                r.nivel(),
                r.errorTipicoKm(),
                r.kmRestantesFabricante(),
                mant.getFecha(),
                resultado.caracteristicas().kmDesdeUltMant(),
                (long) resultado.caracteristicas().diasDesdeUltMant(),
                resultado.avisoIncompleto() != null,
                "SIMULADOS".equals(r.datosEntrenamiento()),
                ahora);

        cache.guardar(idVehiculo, prediccion);
        return prediccion;
    }
}
