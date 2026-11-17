package com.gpsromp.config;

import java.io.IOException;
import java.time.Instant;

import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gpsromp.common.dto.ErrorResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

/**
 * Respuesta para peticiones sin autenticar: 401 con cuerpo JSON.
 *
 * Sin este bean, Spring Security 6 usa Http403ForbiddenEntryPoint cuando no hay
 * un mecanismo de login configurado, así que una petición SIN TOKEN recibía 403.
 * El frontend no podía distinguir "inicia sesión" de "no tienes permiso" y por
 * eso ningún componente maneja el caso de sesión caducada.
 */
@Component
@RequiredArgsConstructor
public class PuntoEntradaAutenticacion implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request,
                         HttpServletResponse response,
                         AuthenticationException authException) throws IOException {

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        String motivo = (String) request.getAttribute("motivoNoAutenticado");
        if (motivo == null) {
            motivo = "Se requiere autenticación";
        }

        objectMapper.writeValue(response.getWriter(), new ErrorResponse(
                HttpServletResponse.SC_UNAUTHORIZED,
                motivo,
                request.getRequestURI(),
                Instant.now(),
                null));
    }
}
