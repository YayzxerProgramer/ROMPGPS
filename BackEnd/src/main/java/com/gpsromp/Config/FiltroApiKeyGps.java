package com.gpsromp.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gpsromp.common.dto.ErrorResponse;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Protege la ingesta de posiciones.
 *
 * POR QUÉ EXISTE: POST /gps era público. Cualquiera en la red podía inyectar
 * posiciones falsas para cualquier IMEI, y esas posiciones se retransmitían por
 * WebSocket a los clientes legítimos y se guardaban en Mongo. Falsificación de
 * trayectorias y, de paso, un vector para inflar la base de datos.
 *
 * No se usa el JWT de usuario porque quien publica es el Servidor-TCP, un
 * servicio, no una persona. Una clave compartida es el mecanismo adecuado:
 * misma clave en GPS_INGESTA_API_KEY de los dos módulos.
 *
 * La comparación es en tiempo constante (MessageDigest.isEqual) para no filtrar
 * información sobre la clave a través del tiempo de respuesta.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FiltroApiKeyGps extends OncePerRequestFilter {

    private static final String CABECERA = "X-API-Key";
    private static final String RUTA_INGESTA = "/gps";

    private final ObjectMapper objectMapper;

    @Value("${gps.ingesta.api-key}")
    private String apiKeyEsperada;

    /** Solo se aplica a POST /gps; el resto de rutas pasan de largo. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !(HttpMethod.POST.matches(request.getMethod())
                && RUTA_INGESTA.equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String recibida = request.getHeader(CABECERA);

        if (recibida == null || !coincide(recibida, apiKeyEsperada)) {
            log.warn("Ingesta GPS rechazada desde {}: clave ausente o incorrecta", request.getRemoteAddr());

            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getWriter(), new ErrorResponse(
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Clave de ingesta inválida",
                    request.getRequestURI(),
                    Instant.now(),
                    null));
            return;
        }

        chain.doFilter(request, response);
    }

    private boolean coincide(String recibida, String esperada) {
        if (esperada == null || esperada.isBlank()) {
            // Sin clave configurada no se acepta nada: mejor cortar la ingesta
            // que aceptarla sin autenticar.
            log.error("gps.ingesta.api-key no está configurada. Se rechaza toda ingesta.");
            return false;
        }
        return MessageDigest.isEqual(
                recibida.getBytes(StandardCharsets.UTF_8),
                esperada.getBytes(StandardCharsets.UTF_8));
    }
}
