package com.gpsromp.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final InterceptorAutenticacionStomp interceptorAutenticacion;

    @Value("${cors.origenes-permitidos}")
    private String origenesPermitidos;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Antes era setAllowedOrigins("*"): se aceptaba el handshake desde
        // cualquier origen. Ahora es la misma lista explícita que usa el REST.
        registry.addEndpoint("/ws-gps")
                .setAllowedOrigins(origenesPermitidos.split(","));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/socket");
        registry.setApplicationDestinationPrefixes("/app");
    }

    /**
     * Registra el interceptor que autentica el CONNECT y autoriza el SUBSCRIBE.
     * Sin esto el canal quedaba completamente abierto.
     */
    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(interceptorAutenticacion);
    }
}
