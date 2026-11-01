package com.gpsromp.gps.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.common.service.SmsService;
import com.gpsromp.gps.model.DispositivoGps;
import com.gpsromp.gps.repository.DispositivoGpsRepository;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Controlador para enviar comandos SMS de respaldo directo a la SIM Card de los GPS GT06.
 * El número telefónico de la SIM reside en MongoDB y se obtiene de forma segura e interna,
 * sin solicitarlo ni exponerlo al usuario final.
 */
@RestController
@RequestMapping("/gps/comando-sms")
@RequiredArgsConstructor
@Slf4j
public class GpsComandoSmsController {

    private final VehiculoRepository vehiculoRepository;
    private final DispositivoGpsRepository dispositivoGpsRepository;
    private final SmsService smsService;

    @Data
    public static class ComandoSmsRequest {
        private String imei;
        private String comando; // CORTE_MOTOR, RESTAURAR_MOTOR, ESTADO
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or @seguridad.esMiImei(#request.imei, authentication)")
    public ResponseEntity<Map<String, Object>> enviarComandoSms(@RequestBody ComandoSmsRequest request) {
        if (request.getImei() == null || request.getImei().isBlank()) {
            throw new IllegalArgumentException("El IMEI es obligatorio");
        }
        if (request.getComando() == null || request.getComando().isBlank()) {
            throw new IllegalArgumentException("El comando es obligatorio");
        }

        String imeiLimpio = request.getImei().trim();

        // 1. Validar que el vehículo exista en PostgreSQL
        Vehiculo vehiculo = vehiculoRepository.findByImei(imeiLimpio)
                .orElseThrow(() -> new RecursoNoEncontradoException("Vehículo no encontrado con IMEI: " + imeiLimpio));

        // 2. Obtener el dispositivo GPS y su SIM Card desde MongoDB
        DispositivoGps dispositivo = dispositivoGpsRepository.findByImei(imeiLimpio)
                .orElseThrow(() -> new OperacionNoPermitidaException(
                        "El dispositivo GPS no está registrado en el sistema. Contacte al administrador."));

        String destinoSms = dispositivo.getNumeroSim();
        if (destinoSms == null || destinoSms.isBlank()) {
            throw new OperacionNoPermitidaException(
                    "El dispositivo GPS no tiene una línea SIM Card configurada. Contacte al administrador.");
        }

        // 3. Resolver comando GT06
        String comandoHex;
        switch (request.getComando().trim().toUpperCase()) {
            case "CORTE_MOTOR":
                comandoHex = "#RELAY,1#";
                break;
            case "RESTAURAR_MOTOR":
                comandoHex = "#RELAY,0#";
                break;
            case "ESTADO":
                comandoHex = "#STATUS#";
                break;
            default:
                throw new IllegalArgumentException("Comando desconocido: " + request.getComando());
        }

        // 4. Enviar SMS directamente a la SIM Card del GPS sin exponer el número al cliente
        boolean enviado = smsService.enviarSms(destinoSms, comandoHex);
        log.info("Comando SMS {} ('{}') despachado hacia el dispositivo GPS con IMEI {} (Placa {})",
                request.getComando(), comandoHex, imeiLimpio, vehiculo.getPlaca());

        return ResponseEntity.ok(Map.of(
                "exito", enviado,
                "imei", imeiLimpio,
                "comando", request.getComando().toUpperCase(),
                "mensaje", enviado ? "Comando SMS enviado correctamente al dispositivo GPS" : "Fallo al entregar el comando SMS al dispositivo"
        ));
    }
}
