package com.gpsromp.config;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

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
 * Límite de peticiones para los endpoints públicos de autenticación.
 *
 * POR QUÉ EXISTE: el límite por intentos fallidos vive en ServicioAutenticacion
 * y solo cubre el LOGIN. El registro, los tres flujos de OAuth, el refresco y
 * las comprobaciones de disponibilidad seguían sin ninguna restricción, de modo
 * que el alta masiva de cuentas y el sondeo de correos existentes continuaban
 * siendo viables.
 *
 * Este filtro cuenta TODAS las peticiones por IP, no solo las fallidas: en el
 * registro no existe el concepto de "intento fallido" —cada llamada crea una
 * cuenta— así que lo que hay que acotar es el volumen.
 *
 * El límite es más holgado que el del login porque aquí una petición legítima
 * es normal y lo que se persigue es el abuso automatizado.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FiltroLimiteIntentos extends OncePerRequestFilter {

    /** Rutas cubiertas. El login queda fuera: lo controla ServicioAutenticacion. */
    private static final List<String> RUTAS_POST = List.of(
            "/usuario",
            "/usuario/google",
            "/usuario/github",
            "/usuario/github/callback",
            "/usuario/refrescar");

    private static final String PREFIJO_EXISTS = "/usuario/exists/";

    private final ServicioLimiteIntentos limiteIntentos;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Value("${seguridad.rate-limit.publico:20}")
    private int maximoPublico;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String ruta = request.getRequestURI();

        boolean esPostCubierto = "POST".equals(request.getMethod()) && RUTAS_POST.contains(ruta);
        boolean esConsultaDisponibilidad = "GET".equals(request.getMethod()) && ruta.startsWith(PREFIJO_EXISTS);

        return !(esPostCubierto || esConsultaDisponibilidad);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // Se agrupa por tipo de operación: agotar el cupo de registro no debe
        // dejar sin refresco a quien comparte la misma IP (una oficina, por ejemplo).
        String clave = "publico:" + grupo(request) + ":" + ipDe(request);

        if (limiteIntentos.estaBloqueado(clave)) {
            long segundos = limiteIntentos.segundosRestantes(clave);
            log.warn("Petición bloqueada por volumen: {} desde {}", request.getRequestURI(), ipDe(request));

            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(segundos));
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");

            objectMapper.writeValue(response.getWriter(), new ErrorResponse(
                    429,
                    "Demasiadas peticiones. Inténtalo de nuevo en " + segundos + " segundos.",
                    request.getRequestURI(),
                    Instant.now(),
                    null));
            return;
        }

        limiteIntentos.registrarFallo(clave, maximoPublico);
        chain.doFilter(request, response);
    }

    private String grupo(HttpServletRequest request) {
        String ruta = request.getRequestURI();
        if (ruta.startsWith(PREFIJO_EXISTS)) {
            return "exists";
        }
        if (ruta.equals("/usuario/refrescar")) {
            return "refresco";
        }
        if (ruta.startsWith("/usuario/g")) {
            return "oauth";
        }
        return "registro";
    }

    private String ipDe(HttpServletRequest peticion) {
        String reenviada = peticion.getHeader("X-Forwarded-For");
        if (reenviada != null && !reenviada.isBlank()) {
            return reenviada.split(",")[0].trim();
        }
        return peticion.getRemoteAddr();
    }
}
