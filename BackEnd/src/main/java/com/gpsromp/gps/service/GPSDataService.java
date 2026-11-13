package com.gpsromp.gps.service;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.gps.model.GPSData;
import com.gpsromp.gps.repository.GPSDataRepository;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import jakarta.annotation.PreDestroy;

@Service
@RequiredArgsConstructor
@Slf4j
public class GPSDataService {

    private final GPSDataRepository repository;
    private final VehiculoRepository vehiculoRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final RedisTemplate<String, Object> redisTemplate;

    private static final String REDIS_PREFIX_GPS = "gps:posicion:";
    private static final long TTL_CACHE_IMEI_MS = 5 * 60 * 1000L; // 5 minutos

    /** Caché en memoria de IMEIs válidos: evita SELECT SQL a Postgres en cada trama (<0.001ms). */
    private final Map<String, Long> cacheImeisValidos = new ConcurrentHashMap<>();

    /** Pool asíncrono para persistir en MongoDB Atlas sin retrasar la difusión WebSocket. */
    private final ExecutorService mongoPersistenciaExecutor = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "mongo-gps-async-writer");
        t.setDaemon(true);
        return t;
    });

    @PreDestroy
    void shutdown() {
        mongoPersistenciaExecutor.shutdown();
    }

    /**
     * Valida si un IMEI pertenece a un vehículo registrado usando caché en RAM
     * para eliminar consultas repetidas a la base de datos relacional.
     */
    public boolean esImeiRegistrado(String imei) {
        if (imei == null || imei.isBlank()) {
            return false;
        }
        Long expiracion = cacheImeisValidos.get(imei);
        long ahora = System.currentTimeMillis();
        if (expiracion != null && ahora < expiracion) {
            return true;
        }

        boolean existe = vehiculoRepository.existsByImei(imei);
        if (existe) {
            cacheImeisValidos.put(imei, ahora + TTL_CACHE_IMEI_MS);
        } else {
            cacheImeisValidos.remove(imei);
        }
        return existe;
    }

    /**
     * Procesa una posición entrante en TIEMPO REAL PURO (< 1 ms):
     * 1. Valida IMEI contra memoria en nanosegundos.
     * 2. Emite de inmediato por WebSocket al navegador.
     * 3. Actualiza la caché en Redis.
     * 4. Encola la persistencia en MongoDB de forma asíncrona (no bloquea el flujo visual).
     */
    public GPSData procesarPosicionTiempoReal(GPSData gpsData) {
        if (gpsData == null) {
            return null;
        }

        String imei = gpsData.getImei();
        if (imei == null || imei.isBlank()) {
            log.warn("Posición descartada: sin IMEI");
            return null;
        }

        if (!esImeiRegistrado(imei)) {
            log.warn("Posición descartada: el IMEI {} no corresponde a ningún vehículo registrado", imei);
            return null;
        }

        Instant momentoFix = gpsData.getRegistradoEn() != null
                ? gpsData.getRegistradoEn()
                : Instant.now();

        GPSData entidad = GPSData.builder()
                .imei(imei)
                .latitud(gpsData.getLatitud())
                .longitud(gpsData.getLongitud())
                .velocidad(gpsData.getVelocidad())
                .gpsValido(gpsData.isGpsValido())
                .acc(gpsData.isAcc())
                .corteMotor(gpsData.isCorteMotor())
                .registradoEn(momentoFix)
                .creadosEn(Instant.now())
                .build();

        // 1. Difusión INMEDIATA por WebSocket (< 1 ms)
        messagingTemplate.convertAndSend("/socket/gps/" + imei, entidad);

        // 2. Caché de última posición en Redis
        try {
            redisTemplate.opsForValue().set(REDIS_PREFIX_GPS + imei, entidad);
        } catch (Exception e) {
            log.warn("No se pudo cachear la posición de {}: {}", imei, e.getMessage());
        }

        // 3. Persistencia en MongoDB Atlas en segundo plano (no bloquea al usuario)
        mongoPersistenciaExecutor.submit(() -> {
            try {
                repository.save(entidad);
            } catch (Exception e) {
                log.error("Fallo al guardar histórico en MongoDB para {}: {}", imei, e.getMessage());
            }
        });

        log.debug("Posición de {} difundida al instante por WebSocket y encolada a Mongo", imei);
        return entidad;
    }

    /**
     * Ingesta estándar (POST /gps o fallback HTTP).
     * Delega al procesador de tiempo real para garantizar ultra baja latencia.
     */
    public GPSData save(GPSData gpsData) {
        String imei = gpsData != null ? gpsData.getImei() : null;
        if (imei == null || imei.isBlank()) {
            throw new IllegalArgumentException("La posición no trae IMEI");
        }

        if (!esImeiRegistrado(imei)) {
            log.warn("Posición descartada: el IMEI {} no corresponde a ningún vehículo registrado", imei);
            throw new RecursoNoEncontradoException(
                    "No hay ningún vehículo registrado con el IMEI " + imei);
        }

        return procesarPosicionTiempoReal(gpsData);
    }

    /** Última posición conocida: primero Redis, si no MongoDB. */
    public Optional<GPSData> getLastPosition(String imei) {
        try {
            Object cacheada = redisTemplate.opsForValue().get(REDIS_PREFIX_GPS + imei);
            if (cacheada instanceof GPSData posicion) {
                return Optional.of(posicion);
            }
        } catch (Exception e) {
            log.warn("Error consultando Redis para {}: {}", imei, e.getMessage());
        }

        Optional<GPSData> enBd = repository.findFirstByImeiOrderByRegistradoEnDesc(imei);

        enBd.ifPresent(gps -> {
            try {
                redisTemplate.opsForValue().set(REDIS_PREFIX_GPS + imei, gps);
            } catch (Exception e) {
                log.warn("No se pudo repoblar la caché de {}: {}", imei, e.getMessage());
            }
        });

        return enBd;
    }

    /**
     * Consulta en lote la última posición de múltiples dispositivos.
     * Consulta primero la caché en Redis y recurre a MongoDB para los faltantes.
     */
    public Map<String, GPSData> getLastPositions(Collection<String> imeis) {
        if (imeis == null || imeis.isEmpty()) {
            return Map.of();
        }

        Map<String, GPSData> resultado = new HashMap<>();
        List<String> pendientes = new ArrayList<>();

        for (String imei : imeis) {
            if (imei == null || imei.isBlank()) continue;
            try {
                Object cacheada = redisTemplate.opsForValue().get(REDIS_PREFIX_GPS + imei);
                if (cacheada instanceof GPSData posicion) {
                    resultado.put(imei, posicion);
                    continue;
                }
            } catch (Exception e) {
                log.warn("Error consultando Redis para {}: {}", imei, e.getMessage());
            }
            pendientes.add(imei);
        }

        for (String imei : pendientes) {
            repository.findFirstByImeiOrderByRegistradoEnDesc(imei).ifPresent(gps -> {
                resultado.put(imei, gps);
                try {
                    redisTemplate.opsForValue().set(REDIS_PREFIX_GPS + imei, gps);
                } catch (Exception e) {
                    log.warn("No se pudo repoblar la caché de {}: {}", imei, e.getMessage());
                }
            });
        }

        return resultado;
    }

    /**
     * Historial de recorrido en un rango de fechas.
     */
    public List<GPSData> getHistorial(String imei, Instant desde, Instant hasta) {
        return repository.findByImeiAndRegistradoEnBetweenOrderByRegistradoEnDesc(imei, desde, hasta);
    }

    /**
    /**
     * Historial analizado con estadísticas completas y trazas en orden ascendente para playback.
     */
    public com.gpsromp.gps.dto.GPSHistorialResponse obtenerHistorialAnalizado(String imei, Instant desde, Instant hasta) {
        List<GPSData> puntos = Optional.ofNullable(repository.findByImeiAndRegistradoEnBetweenOrderByRegistradoEnAsc(imei, desde, hasta))
                .orElseGet(List::of);

        if (puntos.isEmpty()) {
            return com.gpsromp.gps.dto.GPSHistorialResponse.builder()
                    .imei(imei)
                    .puntos(List.of())
                    .distanciaTotalKm(0.0)
                    .velocidadMaximaKmh(0.0)
                    .velocidadPromedioKmh(0.0)
                    .duracionTotalMinutos(0L)
                    .cantidadParadas(0)
                    .paradas(List.of())
                    .build();
        }

        double distanciaTotal = 0.0;
        double maxVelocidad = 0.0;
        double sumaVelocidades = 0.0;
        int puntosValidos = 0;

        java.util.List<com.gpsromp.gps.dto.GPSHistorialResponse.GPSParadaDTO> paradas = new java.util.ArrayList<>();
        GPSData puntoParadaInicio = null;

        for (int i = 0; i < puntos.size(); i++) {
            GPSData actual = puntos.get(i);

            int vel = actual.getVelocidad();
            if (vel > maxVelocidad) maxVelocidad = vel;
            sumaVelocidades += vel;
            puntosValidos++;

            // Calcular distancia con el punto anterior
            if (i > 0) {
                GPSData anterior = puntos.get(i - 1);
                distanciaTotal += calcularHaversineKm(
                        anterior.getLatitud(), anterior.getLongitud(),
                        actual.getLatitud(), actual.getLongitud()
                );
            }

            // Detectar paradas (velocidad <= 1 km/h o sin movimiento por > 3 minutos)
            if (actual.getVelocidad() <= 1) {
                if (puntoParadaInicio == null) {
                    puntoParadaInicio = actual;
                }
            } else {
                if (puntoParadaInicio != null) {
                    Instant tInicio = puntoParadaInicio.getRegistradoEn() != null ? puntoParadaInicio.getRegistradoEn() : Instant.now();
                    Instant tFin = actual.getRegistradoEn() != null ? actual.getRegistradoEn() : Instant.now();
                    long minutosDetenido = java.time.Duration.between(tInicio, tFin).toMinutes();

                    if (minutosDetenido >= 3) {
                        paradas.add(com.gpsromp.gps.dto.GPSHistorialResponse.GPSParadaDTO.builder()
                                .latitud(puntoParadaInicio.getLatitud())
                                .longitud(puntoParadaInicio.getLongitud())
                                .inicio(tInicio.toString())
                                .fin(tFin.toString())
                                .duracionMinutos(minutosDetenido)
                                .build());
                    }
                    puntoParadaInicio = null;
                }
            }
        }

        double velPromedio = puntosValidos > 0 ? (sumaVelocidades / puntosValidos) : 0.0;
        Instant t0 = puntos.get(0).getRegistradoEn() != null ? puntos.get(0).getRegistradoEn() : Instant.now();
        Instant tN = puntos.get(puntos.size() - 1).getRegistradoEn() != null ? puntos.get(puntos.size() - 1).getRegistradoEn() : Instant.now();
        long duracionMinutos = java.time.Duration.between(t0, tN).toMinutes();

        return com.gpsromp.gps.dto.GPSHistorialResponse.builder()
                .imei(imei)
                .puntos(puntos)
                .distanciaTotalKm(Math.round(distanciaTotal * 100.0) / 100.0)
                .velocidadMaximaKmh(Math.round(maxVelocidad * 10.0) / 10.0)
                .velocidadPromedioKmh(Math.round(velPromedio * 10.0) / 10.0)
                .duracionTotalMinutos(duracionMinutos)
                .cantidadParadas(paradas.size())
                .paradas(paradas)
                .build();
    }

    private double calcularHaversineKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Radio de la Tierra en Km
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
