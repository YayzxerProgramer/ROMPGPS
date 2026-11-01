package com.gpsromp.common.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

/**
 * Servicio para envío de SMS y WhatsApp a través de Twilio REST API.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SmsService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${sms.twilio.account-sid:${TWILIO_ACCOUNT_SID:}}")
    private String accountSid;

    @Value("${sms.twilio.auth-token:${TWILIO_AUTH_TOKEN:}}")
    private String authToken;

    @Value("${sms.twilio.api-key:${TWILIO_API_KEY:}}")
    private String apiKey;

    @Value("${sms.twilio.api-secret:${TWILIO_API_SECRET:}}")
    private String apiSecret;

    @Value("${sms.twilio.from-number:${TWILIO_FROM_NUMBER:+17372508034}}")
    private String fromNumber;

    @Value("${sms.twilio.whatsapp-from:${TWILIO_WHATSAPP_FROM:+14155238886}}")
    private String whatsappFrom;

    @Value("${sms.twilio.usar-plantilla-trial:false}")
    private boolean usarPlantillaTrial;

    /**
     * Envía un mensaje SMS a través de Twilio.
     */
    public boolean enviarSms(String numeroDestino, String mensaje) {
        return enviarMensajeTwilio(numeroDestino, mensaje, false);
    }

    /**
     * Envía un mensaje de WhatsApp a través de Twilio.
     */
    public boolean enviarWhatsApp(String numeroDestino, String mensaje) {
        return enviarMensajeTwilio(numeroDestino, mensaje, true);
    }

    private boolean enviarMensajeTwilio(String numeroDestino, String mensaje, boolean esWhatsApp) {
        if (numeroDestino == null || numeroDestino.isBlank()) {
            log.warn("No se proporcionó un número de destino para la mensajería.");
            return false;
        }

        String numeroE164 = formatearE164(numeroDestino);

        String userAuth = null;
        String passAuth = null;

        if (!apiKey.isBlank() && !apiSecret.isBlank()) {
            userAuth = apiKey.trim();
            passAuth = apiSecret.trim();
        } else if (!authToken.isBlank() && !accountSid.isBlank()) {
            userAuth = accountSid.trim();
            passAuth = authToken.trim();
        }

        if (userAuth == null || passAuth == null || accountSid.isBlank()) {
            log.info("[MODO SIMULACIÓN {}] Para: {} | Mensaje: '{}'", esWhatsApp ? "WHATSAPP" : "SMS", numeroE164, mensaje);
            return true;
        }

        try {
            String url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid.trim() + "/Messages.json";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            headers.setBasicAuth(userAuth, passAuth);

            String destinoFinal = esWhatsApp ? "whatsapp:" + numeroE164 : numeroE164;
            String remitenteFinal = esWhatsApp
                    ? (whatsappFrom.startsWith("whatsapp:") ? whatsappFrom.trim() : "whatsapp:" + whatsappFrom.trim())
                    : fromNumber.trim();

            String cuerpoMensaje = (!esWhatsApp && usarPlantillaTrial) ? "sms_2fa" : mensaje;

            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("To", destinoFinal);
            formData.add("From", remitenteFinal);
            formData.add("Body", cuerpoMensaje);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(formData, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("{} Twilio enviado exitosamente a {}: {}", esWhatsApp ? "WhatsApp" : "SMS", destinoFinal, response.getBody());
                return true;
            } else {
                log.error("Error al enviar {} Twilio a {}: Código {} - {}", esWhatsApp ? "WhatsApp" : "SMS", destinoFinal, response.getStatusCode(), response.getBody());
                return false;
            }
        } catch (HttpStatusCodeException e) {
            log.error("Error HTTP Twilio al enviar {} a {}: {} - {}", esWhatsApp ? "WhatsApp" : "SMS", numeroE164, e.getStatusCode(), e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            log.error("Excepción inesperada al enviar {} Twilio a {}: {}", esWhatsApp ? "WhatsApp" : "SMS", numeroE164, e.getMessage(), e);
            return false;
        }
    }

    /**
     * Formatea el número a estándar E.164 (+57313... para Colombia).
     */
    private String formatearE164(String numero) {
        if (numero == null || numero.isBlank()) return "";
        String limpio = numero.replaceAll("[^0-9]", "");
        if (limpio.length() == 10) {
            return "+57" + limpio;
        }
        if (limpio.startsWith("57") && limpio.length() == 12) {
            return "+" + limpio;
        }
        return "+" + limpio;
    }
}
