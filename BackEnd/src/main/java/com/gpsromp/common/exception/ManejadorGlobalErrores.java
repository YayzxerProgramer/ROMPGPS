package com.gpsromp.common.exception;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import com.gpsromp.common.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Manejador único de errores para toda la API.
 *
 * Reemplaza el patrón anterior de try/catch por método:
 *     catch (RuntimeException e) { return ResponseEntity.notFound().build(); }
 * que convertía cualquier fallo (correo duplicado, Postgres caído, id inexistente)
 * en el mismo 404 sin cuerpo, haciendo imposible depurar desde el cliente.
 */
@RestControllerAdvice
@Slf4j
public class ManejadorGlobalErrores {

    private static final String MENSAJE_ERROR_INTERNO =
            "Ocurrió un error interno. Inténtalo de nuevo en unos minutos.";

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<ErrorResponse> noEncontrado(RecursoNoEncontradoException e, HttpServletRequest req) {
        return construir(HttpStatus.NOT_FOUND, e.getMessage(), req);
    }

    @ExceptionHandler(RecursoDuplicadoException.class)
    public ResponseEntity<ErrorResponse> duplicado(RecursoDuplicadoException e, HttpServletRequest req) {
        return construir(HttpStatus.CONFLICT, e.getMessage(), req);
    }

    @ExceptionHandler(OperacionNoPermitidaException.class)
    public ResponseEntity<ErrorResponse> noPermitida(OperacionNoPermitidaException e, HttpServletRequest req) {
        return construir(HttpStatus.CONFLICT, e.getMessage(), req);
    }

    /**
     * Red de seguridad para las constraints UNIQUE de la base de datos.
     * Los existsBy* del servicio son check-then-act: dos peticiones simultáneas
     * pasan ambas la comprobación y una revienta aquí. Sin esto sería un 500.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> integridad(DataIntegrityViolationException e, HttpServletRequest req) {
        log.warn("Violación de integridad en {}: {}", req.getRequestURI(), e.getMostSpecificCause().getMessage());
        return construir(HttpStatus.CONFLICT,
                "El registro entra en conflicto con uno existente (usuario, correo, placa o IMEI duplicado)", req);
    }

    /** Errores de @Valid: se devuelve el detalle campo a campo. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validacion(MethodArgumentNotValidException e, HttpServletRequest req) {
        Map<String, String> campos = new HashMap<>();
        e.getBindingResult().getFieldErrors()
                .forEach(f -> campos.putIfAbsent(f.getField(), f.getDefaultMessage()));

        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ErrorResponse.deValidacion(
                        HttpStatus.BAD_REQUEST.value(),
                        "Datos inválidos",
                        req.getRequestURI(),
                        campos));
    }

    /**
     * Cuerpo JSON ilegible: mal formado, o un valor que no encaja con el tipo
     * destino. El caso típico es un enum: {"rol":"SUPERADMIN"} hace que Jackson
     * lance InvalidFormatException, y sin este manejador salía como 500.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> cuerpoIlegible(HttpMessageNotReadableException e, HttpServletRequest req) {
        String mensaje = "El cuerpo de la petición no es válido";

        if (e.getCause() instanceof InvalidFormatException ife) {
            Class<?> destino = ife.getTargetType();
            if (destino != null && destino.isEnum()) {
                mensaje = "Valor no admitido: '" + ife.getValue() + "'. Valores válidos: "
                        + String.join(", ", Arrays.stream(destino.getEnumConstants())
                                .map(Object::toString).toList());
            } else {
                mensaje = "Valor con formato inválido: '" + ife.getValue() + "'";
            }
        }

        return construir(HttpStatus.BAD_REQUEST, mensaje, req);
    }

    /** Un UUID mal formado en la ruta es culpa del cliente: 400, no 500. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> tipoInvalido(MethodArgumentTypeMismatchException e, HttpServletRequest req) {
        return construir(HttpStatus.BAD_REQUEST,
                "Valor inválido para el parámetro '" + e.getName() + "'", req);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> argumentoInvalido(IllegalArgumentException e, HttpServletRequest req) {
        return construir(HttpStatus.BAD_REQUEST, e.getMessage(), req);
    }

    /** Sin permisos: 403. Lo lanza @PreAuthorize cuando la expresión falla. */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> accesoDenegado(AccessDeniedException e, HttpServletRequest req) {
        return construir(HttpStatus.FORBIDDEN, "No tienes permisos para esta operación", req);
    }

    /** Sin autenticar o con credenciales inválidas: 401, nunca 403. */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> noAutenticado(AuthenticationException e, HttpServletRequest req) {
        return construir(HttpStatus.UNAUTHORIZED, "No autenticado", req);
    }

    /**
     * Último recurso: el detalle (stacktrace, SQL) va al log y al cliente solo un
     * mensaje genérico. Devolver e.getMessage() exponía en el navegador las
     * consultas SQL, nombres de tablas y columnas de la base de datos.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> inesperado(Exception e, HttpServletRequest req) {
        log.error("Error no controlado en {} {}", req.getMethod(), req.getRequestURI(), e);
        return construir(HttpStatus.INTERNAL_SERVER_ERROR, MENSAJE_ERROR_INTERNO, req);
    }

    private ResponseEntity<ErrorResponse> construir(HttpStatus estado, String mensaje, HttpServletRequest req) {
        return ResponseEntity.status(estado)
                .body(ErrorResponse.de(estado.value(), mensaje, req.getRequestURI()));
    }
}
