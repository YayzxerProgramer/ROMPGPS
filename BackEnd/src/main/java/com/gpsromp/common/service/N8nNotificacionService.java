package com.gpsromp.common.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Servicio para despachar notificaciones externas (correos, webhooks, alertas) hacia n8n.
 * Actúa como orquestador de salida sin involucrar a n8n en la lógica interna del negocio.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class N8nNotificacionService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${n8n.webhook.email-url:${N8N_WEBHOOK_EMAIL_URL:http://localhost:5678/webhook/rompgps-alertas}}")
    private String n8nWebhookUrl;

    /**
     * Envía un correo de código OTP o recuperación a través de n8n.
     */
    public boolean enviarCorreoOtp(String correoDestino, String nombreUsuario, String codigo, String tipoEvento, int expiraMinutos) {
        if (correoDestino == null || correoDestino.isBlank()) {
            log.warn("No se proporcionó un correo de destino para la notificación n8n.");
            return false;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("tipo", tipoEvento); // "LOGIN_2FA", "RECUPERAR_PASSWORD", "ACTIVAR_2FA"
        payload.put("canal", "EMAIL");

        Map<String, String> destinatario = new HashMap<>();
        destinatario.put("correo", correoDestino);
        destinatario.put("nombre", nombreUsuario != null ? nombreUsuario : "Usuario");
        payload.put("destinatario", destinatario);

        Map<String, Object> datos = new HashMap<>();
        datos.put("codigo", codigo);
        datos.put("expiracionMinutos", expiraMinutos);
        datos.put("asunto", obtenerAsunto(tipoEvento));
        payload.put("datos", datos);

        return despacharHaciaN8n(payload, "Correo OTP (" + tipoEvento + ") hacia " + correoDestino);
    }

    /**
     * Despacha alertas telemáticas o de mantenimiento hacia n8n (para envío por WhatsApp o correo).
     */
    public boolean despacharAlertaTelematica(String tipoAlerta, String canal, String telefono, String correo, String nombre, Map<String, Object> datosExtras) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("tipo", tipoAlerta); // "ALERTA_MOVIMIENTO", "CORTE_MOTOR", "MANTENIMIENTO_PREDICTIVO"
        payload.put("canal", canal != null ? canal : "WHATSAPP");

        Map<String, String> destinatario = new HashMap<>();
        destinatario.put("telefono", telefono != null ? telefono : "");
        destinatario.put("correo", correo != null ? correo : "");
        destinatario.put("nombre", nombre != null ? nombre : "Usuario");
        payload.put("destinatario", destinatario);

        payload.put("datos", datosExtras != null ? datosExtras : Map.of());

        return despacharHaciaN8n(payload, "Alerta telemática (" + tipoAlerta + ") por " + canal);
    }

    private boolean despacharHaciaN8n(Map<String, Object> payload, String descripcion) {
        if (n8nWebhookUrl == null || n8nWebhookUrl.isBlank()) {
            log.info("[SIMULACIÓN N8N - Webhook no configurado] {}: {}", descripcion, payload);
            return true;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(n8nWebhookUrl, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Evento n8n despachado con éxito [{}]: {}", descripcion, response.getStatusCode());
                return true;
            } else {
                log.warn("Respuesta no exitosa de n8n al despachar [{}]: Código {}", descripcion, response.getStatusCode());
                return false;
            }
        } catch (Exception e) {
            log.warn("[AVISO] No se pudo conectar con el webhook de n8n ({}): {}. Simulado en consola: {}",
                    n8nWebhookUrl, e.getMessage(), payload);
            // Retornamos true en desarrollo para no bloquear el flujo si n8n está apagado
            return true;
        }
    }

    private String obtenerAsunto(String tipoEvento) {
        if ("RECUPERAR_PASSWORD".equals(tipoEvento)) {
            return "RompGPS - Recuperación de Contraseña";
        } else if ("ACTIVAR_2FA".equals(tipoEvento)) {
            return "RompGPS - Verificación para Activar 2FA";
        }
        return "RompGPS - Tu Código de Verificación 2FA";
    }
}
