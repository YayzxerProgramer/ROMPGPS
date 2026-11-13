package com.gpsromp.vehiculo.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Servicio programado para evaluar las fechas de vencimiento del SOAT y de la
 * Revisión Técnico-Mecánica (RTM).
 *
 * Se ejecuta automáticamente a diario y despacha notificaciones hacia n8n cuando
 * faltan 30, 15, 5, 0 o -1 días para el vencimiento de cada documento.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AlertaDocumentosVehiculoService {

    private final VehiculoRepository vehiculoRepository;
    private final UsuarioRepository usuarioRepository;
    private final N8nNotificacionService notificacionService;

    // Umbrales en días para disparar alertas
    private static final Set<Long> DIAS_UMBRAL = Set.of(30L, 15L, 5L, 0L, -1L);

    /**
     * Tarea programada por defecto a las 07:00 AM hora de Colombia (America/Bogota).
     */
    @Scheduled(cron = "${alertas.documentos.cron:0 0 7 * * ?}", zone = "America/Bogota")
    @Transactional(readOnly = true)
    public void ejecutarRevisionDiaria() {
        log.info("Iniciando revisión diaria de vencimientos de SOAT y Tecnomecánica...");
        int enviadas = procesarAlertas(LocalDate.now());
        log.info("Revisión de documentos completada. Alertas despachadas: {}", enviadas);
    }

    /**
     * Permite ejecutar la revisión manualmente bajo demanda (para pruebas o endpoint admin).
     */
    @Transactional(readOnly = true)
    public int ejecutarRevisionManual() {
        return procesarAlertas(LocalDate.now());
    }

    public int procesarAlertas(LocalDate hoy) {
        List<Vehiculo> vehiculos = vehiculoRepository.findVehiculosActivosConDocumentos();
        if (vehiculos == null || vehiculos.isEmpty()) {
            return 0;
        }

        // Caché local de usuarios para no repetir consultas en la misma corrida
        Map<UUID, Optional<Usuario>> cacheUsuarios = new HashMap<>();
        int contadorAlertas = 0;

        for (Vehiculo vehiculo : vehiculos) {
            if (vehiculo.getId_usuario() == null) {
                continue;
            }

            Usuario usuario = cacheUsuarios.computeIfAbsent(
                    vehiculo.getId_usuario(),
                    usuarioRepository::findById
            ).orElse(null);

            if (usuario == null || !Boolean.TRUE.equals(usuario.getActivo())) {
                continue;
            }

            // Evaluar SOAT
            if (vehiculo.getFechaVencimientoSoat() != null) {
                long diasSoat = ChronoUnit.DAYS.between(hoy, vehiculo.getFechaVencimientoSoat());
                if (DIAS_UMBRAL.contains(diasSoat)) {
                    despacharAlerta(vehiculo, usuario, "SOAT", vehiculo.getFechaVencimientoSoat(), diasSoat);
                    contadorAlertas++;
                }
            }

            // Evaluar Tecnomecánica
            if (vehiculo.getFechaVencimientoTecnomecanica() != null) {
                long diasTecno = ChronoUnit.DAYS.between(hoy, vehiculo.getFechaVencimientoTecnomecanica());
                if (DIAS_UMBRAL.contains(diasTecno)) {
                    despacharAlerta(vehiculo, usuario, "TECNOMECANICA", vehiculo.getFechaVencimientoTecnomecanica(), diasTecno);
                    contadorAlertas++;
                }
            }
        }

        return contadorAlertas;
    }

    private void despacharAlerta(Vehiculo vehiculo, Usuario usuario, String tipoDoc, LocalDate fechaVencimiento, long diasRestantes) {
        String tipoEvento = "VENCIMIENTO_" + tipoDoc;
        String mensaje = construirMensajeAlerta(vehiculo.getPlaca(), tipoDoc, fechaVencimiento, diasRestantes);

        Map<String, Object> extras = new HashMap<>();
        extras.put("placa", vehiculo.getPlaca());
        extras.put("modelo", vehiculo.getModelo());
        extras.put("tipoDocumento", tipoDoc);
        extras.put("fechaVencimiento", fechaVencimiento.toString());
        extras.put("diasRestantes", diasRestantes);
        extras.put("mensaje", mensaje);

        log.info("Despachando alerta de {} para vehículo {} (días restantes: {}) al usuario {}",
                tipoDoc, vehiculo.getPlaca(), diasRestantes, usuario.getCorreo());

        // Despachamos preferentemente por WhatsApp o Correo a través de n8n
        String canal = (usuario.getTelefono() != null && !usuario.getTelefono().isBlank()) ? "WHATSAPP" : "EMAIL";
        notificacionService.despacharAlertaTelematica(
                tipoEvento,
                canal,
                usuario.getTelefono(),
                usuario.getCorreo(),
                usuario.getNombre(),
                extras
        );
    }

    private String construirMensajeAlerta(String placa, String tipoDoc, LocalDate fechaVencimiento, long diasRestantes) {
        String nombreDoc = "SOAT".equals(tipoDoc) ? "SOAT" : "Revisión Técnico-Mecánica (RTM)";
        if (diasRestantes < 0) {
            return String.format("¡Atención! El %s de tu vehículo %s está VENCIDO desde el %s.", nombreDoc, placa, fechaVencimiento);
        } else if (diasRestantes == 0) {
            return String.format("¡Urgente! El %s de tu vehículo %s VENCE HOY (%s).", nombreDoc, placa, fechaVencimiento);
        } else {
            return String.format("Aviso preventivo: El %s de tu vehículo %s vencerá en %d días (el %s).", nombreDoc, placa, diasRestantes, fechaVencimiento);
        }
    }
}
