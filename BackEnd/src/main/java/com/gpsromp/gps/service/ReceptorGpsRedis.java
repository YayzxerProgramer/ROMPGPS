package com.gpsromp.gps.service;

import java.nio.charset.StandardCharsets;

import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gpsromp.gps.model.GPSData;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Receptor de posiciones en tiempo real desde Redis Pub/Sub (< 1 ms).
 * Recibe los datos enviados por el Servidor-TCP y los entrega de inmediato al
 * GPSDataService sin esperas HTTP ni bloqueos de red.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class ReceptorGpsRedis implements MessageListener {

    private final GPSDataService gpsDataService;
    private final ObjectMapper objectMapper;

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String json = new String(message.getBody(), StandardCharsets.UTF_8);
            GPSData gps = objectMapper.readValue(json, GPSData.class);
            gpsDataService.procesarPosicionTiempoReal(gps);
        } catch (Exception e) {
            log.error("Error al procesar trama GPS desde canal Redis: {}", e.getMessage());
        }
    }
}
