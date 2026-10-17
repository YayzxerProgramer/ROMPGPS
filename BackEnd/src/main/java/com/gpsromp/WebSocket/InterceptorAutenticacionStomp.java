package com.gpsromp.WebSocket;

import java.util.List;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import com.gpsromp.config.JwtUtil;
import com.gpsromp.config.SeguridadService;
import com.gpsromp.config.ServicioDetallesUsuario;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Autenticación y autorización del canal STOMP.
 *
 * POR QUÉ EXISTE: /ws-gps era permitAll y no había ningún interceptor.
 * Cualquiera podía abrir ws://host:8081/ws-gps, suscribirse a
 * /socket/gps/{imei} y rastrear un vehículo en tiempo real sin token. Como los
 * IMEI se podían enumerar con una cuenta gratuita, era rastreo de flotas
 * completas. Esto dejaba en decorativo el 403 del endpoint REST de posiciones.
 *
 * Dos controles:
 *
 *  CONNECT   — exige un access token válido en la cabecera Authorization del
 *              frame y asocia el usuario a la sesión.
 *  SUBSCRIBE — comprueba que el IMEI del destino pertenezca a quien se
 *              suscribe. Sin esto, autenticarse bastaría para espiar cualquier
 *              vehículo, que es el mismo agujero con un paso más.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class InterceptorAutenticacionStomp implements ChannelInterceptor {

    /** Los destinos son /socket/gps/{imei}. */
    private static final String PREFIJO_DESTINO_GPS = "/socket/gps/";

    private final JwtUtil jwtUtil;
    private final ServicioDetallesUsuario servicioDetallesUsuario;
    private final SeguridadService seguridadService;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {

        StompHeaderAccessor accesor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accesor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accesor.getCommand())) {
            autenticar(accesor);
        } else if (StompCommand.SUBSCRIBE.equals(accesor.getCommand())) {
            autorizarSuscripcion(accesor);
        }

        return message;
    }

    private void autenticar(StompHeaderAccessor accesor) {
        String token = extraerToken(accesor);

        if (token == null || !jwtUtil.esAccesoValido(token)) {
            throw new IllegalArgumentException("Se requiere un token válido para conectar al WebSocket");
        }

        try {
            String nombreUsuario = jwtUtil.extraerUsuario(token);
            UserDetails detalles = servicioDetallesUsuario.loadUserByUsername(nombreUsuario);

            var auth = new UsernamePasswordAuthenticationToken(
                    detalles, null, detalles.getAuthorities());

            // setUser deja el principal en la sesión STOMP, así el SUBSCRIBE
            // posterior sabe quién es sin volver a leer el token.
            accesor.setUser(auth);
            log.debug("WebSocket conectado: {}", nombreUsuario);

        } catch (Exception e) {
            // Cuenta borrada o desactivada con un token todavía vigente.
            throw new IllegalArgumentException("La cuenta no está disponible");
        }
    }

    private void autorizarSuscripcion(StompHeaderAccessor accesor) {
        String destino = accesor.getDestination();

        if (destino == null || !destino.startsWith(PREFIJO_DESTINO_GPS)) {
            // Destinos que no son de GPS: basta con estar autenticado.
            if (accesor.getUser() == null) {
                throw new IllegalArgumentException("No autenticado");
            }
            return;
        }

        if (!(accesor.getUser() instanceof UsernamePasswordAuthenticationToken auth)) {
            throw new IllegalArgumentException("No autenticado");
        }

        String imei = destino.substring(PREFIJO_DESTINO_GPS.length());

        boolean esAdmin = seguridadService.esAdmin(auth);
        boolean esSuyo = seguridadService.esMiImei(imei, auth);

        if (!esAdmin && !esSuyo) {
            log.warn("Suscripción rechazada: '{}' intentó escuchar el IMEI {}", auth.getName(), imei);
            throw new IllegalArgumentException("No tienes acceso a ese dispositivo");
        }
    }

    /**
     * Lee el token de la cabecera nativa del frame CONNECT.
     * El cliente lo envía en connectHeaders, no en la URL: una URL con el token
     * acabaría en los logs del servidor y en el historial del navegador.
     */
    private String extraerToken(StompHeaderAccessor accesor) {
        List<String> cabeceras = accesor.getNativeHeader("Authorization");

        if (cabeceras == null || cabeceras.isEmpty()) {
            return null;
        }

        String valor = cabeceras.get(0);
        return (valor != null && valor.startsWith("Bearer ")) ? valor.substring(7) : valor;
    }
}
