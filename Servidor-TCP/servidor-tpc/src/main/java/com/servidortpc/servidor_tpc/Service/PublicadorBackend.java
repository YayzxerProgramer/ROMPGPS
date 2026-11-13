package com.servidortpc.servidor_tpc.Service;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servidortpc.servidor_tpc.Model.GPSData;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

/**
 * Publicador híbrido de ultra baja latencia.
 *
 * CANAL PRINCIPAL: Redis Pub/Sub (< 1 ms de latencia pura en memoria).
 * CANAL SECUNDARIO / FALLBACK: HTTP POST asíncrono con pool concurrente hacia
 * el BackEnd si Redis no está disponible.
 */
@Service
public class PublicadorBackend {

    private static final Logger log = LoggerFactory.getLogger(PublicadorBackend.class);

    private static final int CAPACIDAD_COLA = 10_000;
    private static final int MAXIMO_REINTENTOS = 3;
    private static final long ESPERA_BASE_MS = 500;

    private final RestTemplate restTemplate;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final BlockingQueue<Pendiente> colaHttp = new ArrayBlockingQueue<>(CAPACIDAD_COLA);

    private ExecutorService trabajadorHttp;
    private volatile boolean activo = true;

    @Value("${backend.base-url:http://localhost:8081}")
    private String backendBaseUrl = "http://localhost:8081";

    @Value("${gps.ingesta.api-key:}")
    private String apiKey = "";

    @Value("${gps.redis.canal-posiciones:gps:posiciones}")
    private String canalRedis = "gps:posiciones";

    public PublicadorBackend(
            RestTemplate restTemplate,
            @Autowired(required = false) StringRedisTemplate redisTemplate,
            @Autowired(required = false) ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @PostConstruct
    void iniciar() {
        trabajadorHttp = Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "publicador-http-fallback");
            t.setDaemon(true);
            return t;
        });
        for (int i = 0; i < 4; i++) {
            trabajadorHttp.submit(this::procesarColaHttp);
        }
        log.info("Publicador de ultra baja latencia iniciado. Canal Redis: '{}', Fallback HTTP: '{}'",
                canalRedis, backendBaseUrl);
    }

    @PreDestroy
    void detener() {
        activo = false;
        if (trabajadorHttp != null) {
            trabajadorHttp.shutdownNow();
        }
    }

    /**
     * Publica la posición con prioridad ultra-rápida por Redis (< 1ms).
     * Si Redis no está disponible o falla, encola hacia HTTP como respaldo seguro.
     */
    public void publicar(GPSData gps) {
        boolean publicadoPorRedis = false;

        if (redisTemplate != null) {
            try {
                String json = objectMapper.writeValueAsString(gps);
                redisTemplate.convertAndSend(canalRedis, json);
                publicadoPorRedis = true;
                log.debug("Posición de {} publicada instantáneamente por Redis en canal '{}'", gps.getImei(), canalRedis);
            } catch (Exception e) {
                log.warn("Fallo al publicar por Redis ({}), recurriendo a cola HTTP de respaldo", e.getMessage());
            }
        }

        // Si Redis falló o no está configurado, asegurar entrega por HTTP
        if (!publicadoPorRedis) {
            encolarHttp(gps, 0);
        }
    }

    private void encolarHttp(GPSData gps, int intento) {
        if (!colaHttp.offer(new Pendiente(gps, intento))) {
            Pendiente descartada = colaHttp.poll();
            colaHttp.offer(new Pendiente(gps, intento));
            log.warn("Cola HTTP llena ({}). Descartada posición antigua de {}",
                    CAPACIDAD_COLA, descartada == null ? "?" : descartada.gps.getImei());
        }
    }

    private void procesarColaHttp() {
        while (activo) {
            try {
                Pendiente pendiente = colaHttp.take();
                enviarHttp(pendiente);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.error("Error inesperado en publicador HTTP: {}", e.getMessage());
            }
        }
    }

    private void enviarHttp(Pendiente pendiente) {
        try {
            HttpHeaders cabeceras = new HttpHeaders();
            cabeceras.setContentType(MediaType.APPLICATION_JSON);
            cabeceras.set("X-API-Key", apiKey);

            restTemplate.postForEntity(
                    backendBaseUrl + "/gps",
                    new HttpEntity<>(pendiente.gps, cabeceras),
                    Void.class);

        } catch (Exception e) {
            int intento = pendiente.intento + 1;
            if (intento >= MAXIMO_REINTENTOS) {
                log.error("Posición HTTP de {} descartada tras {} intentos: {}",
                        pendiente.gps.getImei(), MAXIMO_REINTENTOS, e.getMessage());
                return;
            }
            long espera = ESPERA_BASE_MS * (1L << (intento - 1));
            try {
                TimeUnit.MILLISECONDS.sleep(espera);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return;
            }
            encolarHttp(pendiente.gps, intento);
        }
    }

    private record Pendiente(GPSData gps, int intento) {
    }
}
