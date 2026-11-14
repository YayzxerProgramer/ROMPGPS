package com.servidortpc.servidor_tpc.Service;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.servidortpc.servidor_tpc.Model.GPSData;

@ExtendWith(MockitoExtension.class)
class PublicadorBackendTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private StringRedisTemplate redisTemplate;

    private ObjectMapper objectMapper;
    private PublicadorBackend publicadorBackend;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        publicadorBackend = new PublicadorBackend(restTemplate, redisTemplate, objectMapper);
    }

    @Test
    @DisplayName("publicar() envía de inmediato por Redis Pub/Sub en <1ms")
    void publicaPorRedisExitosamente() {
        GPSData gps = new GPSData("867123045678901", Instant.now(), 10.425, -75.540, 45, true, true, false);

        publicadorBackend.publicar(gps);

        verify(redisTemplate, times(1)).convertAndSend(eq("gps:posiciones"), anyString());
    }

    @Test
    @DisplayName("Si Redis falla, publicar() no arroja excepción y recurre a fallback")
    void fallbackCuandoRedisFalla() {
        GPSData gps = new GPSData("867123045678901", Instant.now(), 10.425, -75.540, 45, true, true, false);

        doThrow(new RuntimeException("Redis desconectado")).when(redisTemplate).convertAndSend(eq("gps:posiciones"), anyString());

        // No debe lanzar excepción hacia quien llama (Netty event loop)
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> {
            publicadorBackend.publicar(gps);
        });

        verify(redisTemplate, times(1)).convertAndSend(eq("gps:posiciones"), anyString());
    }
}
