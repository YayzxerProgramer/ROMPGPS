package com.gpsromp.mantenimiento.prediccion;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import lombok.extern.slf4j.Slf4j;

/**
 * Cliente del ml-service.
 *
 * Nunca lanza: si el servicio está apagado, tarda o responde mal, devuelve vacío
 * y el llamador muestra SERVICIO_NO_DISPONIBLE. El resto de la plataforma no
 * debe caerse porque el módulo de predicción no esté levantado.
 *
 * ml.api-key es opcional A PROPÓSITO (a diferencia de los demás secretos, que
 * hacen fallar el arranque): quien no use la predicción no tiene por qué
 * configurarla, y el backend debe seguir arrancando. Sin clave, la predicción
 * queda desactivada y lo registra en el log.
 *
 * Tras un fallo se deja de llamar durante 30 s, para que un servicio caído no
 * convierta cada fila de un listado en una espera de varios segundos.
 */
@Component
@Slf4j
public class ClienteMl {

    private static final long ENFRIAMIENTO_MS = 30_000;

    private final RestClient http;
    private final String clave;
    private final AtomicLong noReintentarHasta = new AtomicLong(0);

    public ClienteMl(@Value("${ml.url:http://localhost:8000}") String url,
                     @Value("${ml.api-key:}") String clave) {
        this.clave = clave;

        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(2000);
        fabrica.setReadTimeout(5000);
        this.http = RestClient.builder().baseUrl(url).requestFactory(fabrica).build();

        if (clave == null || clave.isBlank()) {
            log.warn("ML_API_KEY no está definida: la predicción de mantenimiento queda desactivada.");
        }
    }

    public Optional<RespuestaMl> predecir(CaracteristicasCiclo caracteristicas) {
        if (clave == null || clave.isBlank()) return Optional.empty();
        if (System.currentTimeMillis() < noReintentarHasta.get()) return Optional.empty();

        try {
            RespuestaMl respuesta = http.post()
                    .uri("/predecir")
                    .header("X-API-Key", clave)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(caracteristicas)
                    .retrieve()
                    .body(RespuestaMl.class);
            return Optional.ofNullable(respuesta);
        } catch (Exception e) {
            noReintentarHasta.set(System.currentTimeMillis() + ENFRIAMIENTO_MS);
            log.warn("ml-service no disponible ({}). Se reintenta en 30 s.", e.getMessage());
            return Optional.empty();
        }
    }
}
