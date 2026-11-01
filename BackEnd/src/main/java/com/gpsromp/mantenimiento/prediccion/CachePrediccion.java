package com.gpsromp.mantenimiento.prediccion;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gpsromp.mantenimiento.dto.PrediccionMantenimientoResponse;

import lombok.extern.slf4j.Slf4j;

/**
 * Caché de predicciones en Redis (1 hora).
 *
 * Calcular una predicción recorre todas las posiciones GPS del ciclo, así que se
 * guarda el resultado. No se usa @Cacheable porque RedisConfig deshabilita los
 * nulos y ya dio un 500 con Optional; aquí el JSON se (de)serializa a un tipo
 * concreto, sin tipado polimórfico.
 *
 * Solo se guardan predicciones OK. Redis es opcional: cualquier fallo se ignora
 * y simplemente se recalcula.
 */
@Component
@Slf4j
public class CachePrediccion {

    private static final Duration TTL = Duration.ofHours(1);
    private static final String PREFIJO = "mantenimiento:prediccion:v1:";

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public CachePrediccion(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public Optional<PrediccionMantenimientoResponse> leer(UUID idVehiculo) {
        try {
            String json = redis.opsForValue().get(PREFIJO + idVehiculo);
            if (json == null) return Optional.empty();
            return Optional.of(mapper.readValue(json, PrediccionMantenimientoResponse.class));
        } catch (Exception e) {
            log.warn("No se pudo leer la caché de predicción de {}: {}", idVehiculo, e.getMessage());
            return Optional.empty();
        }
    }

    public void guardar(UUID idVehiculo, PrediccionMantenimientoResponse prediccion) {
        try {
            redis.opsForValue().set(PREFIJO + idVehiculo, mapper.writeValueAsString(prediccion), TTL);
        } catch (Exception e) {
            log.warn("No se pudo guardar la caché de predicción de {}: {}", idVehiculo, e.getMessage());
        }
    }

    /**
     * Borra la predicción. Si hay una transacción en curso se espera a que
     * confirme: borrar antes permitiría que otra petición recalculara y volviera
     * a cachear el dato viejo antes del commit.
     */
    public void invalidar(UUID idVehiculo) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    borrar(idVehiculo);
                }
            });
        } else {
            borrar(idVehiculo);
        }
    }

    private void borrar(UUID idVehiculo) {
        try {
            redis.delete(PREFIJO + idVehiculo);
        } catch (Exception e) {
            log.warn("No se pudo invalidar la caché de predicción de {}: {}", idVehiculo, e.getMessage());
        }
    }
}
