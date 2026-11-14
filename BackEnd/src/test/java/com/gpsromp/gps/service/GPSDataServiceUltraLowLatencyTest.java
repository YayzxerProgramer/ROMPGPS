package com.gpsromp.gps.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.DefaultMessage;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gpsromp.gps.model.GPSData;
import com.gpsromp.gps.repository.GPSDataRepository;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

@ExtendWith(MockitoExtension.class)
class GPSDataServiceUltraLowLatencyTest {

    @Mock
    private GPSDataRepository repository;

    @Mock
    private VehiculoRepository vehiculoRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    private GPSDataService gpsDataService;
    private ReceptorGpsRedis receptorGpsRedis;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        gpsDataService = new GPSDataService(repository, vehiculoRepository, messagingTemplate, redisTemplate);
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        receptorGpsRedis = new ReceptorGpsRedis(gpsDataService, objectMapper);
    }

    @Test
    void procesarPosicionTiempoReal_DifundeInmediatamenteAWebSocket_Y_CreaCacheImei() {
        String imei = "867123045678901";
        when(vehiculoRepository.existsByImei(imei)).thenReturn(true);

        GPSData entrada = GPSData.builder()
                .imei(imei)
                .latitud(10.425)
                .longitud(-75.540)
                .velocidad(45)
                .gpsValido(true)
                .acc(true)
                .registradoEn(Instant.now())
                .build();

        // Primer procesamiento
        GPSData procesada1 = gpsDataService.procesarPosicionTiempoReal(entrada);
        assertNotNull(procesada1);
        verify(messagingTemplate, times(1)).convertAndSend(eq("/socket/gps/" + imei), any(GPSData.class));
        verify(valueOperations, times(1)).set(eq("gps:posicion:" + imei), any(GPSData.class));

        // Segundo procesamiento: el IMEI DEBE venir de la caché en RAM sin volver a llamar a PostgreSQL
        GPSData procesada2 = gpsDataService.procesarPosicionTiempoReal(entrada);
        assertNotNull(procesada2);
        verify(vehiculoRepository, times(1)).existsByImei(imei); // Solo 1 llamada a BD relacional
        verify(messagingTemplate, times(2)).convertAndSend(eq("/socket/gps/" + imei), any(GPSData.class));
    }

    @Test
    void receptorRedis_RecibeMensajeJson_Y_EntregaAGpsDataService() {
        String imei = "867123045678901";
        when(vehiculoRepository.existsByImei(imei)).thenReturn(true);

        String json = """
                {
                    "imei": "%s",
                    "latitud": 11.240,
                    "longitud": -74.210,
                    "velocidad": 60,
                    "gpsValido": true,
                    "acc": true,
                    "corteMotor": false,
                    "registradoEn": "2026-11-13T22:00:00Z"
                }
                """.formatted(imei);

        DefaultMessage message = new DefaultMessage(
                "gps:posiciones".getBytes(StandardCharsets.UTF_8),
                json.getBytes(StandardCharsets.UTF_8)
        );

        receptorGpsRedis.onMessage(message, null);

        verify(messagingTemplate, times(1)).convertAndSend(eq("/socket/gps/" + imei), any(GPSData.class));
        verify(valueOperations, times(1)).set(eq("gps:posicion:" + imei), any(GPSData.class));
    }
}
