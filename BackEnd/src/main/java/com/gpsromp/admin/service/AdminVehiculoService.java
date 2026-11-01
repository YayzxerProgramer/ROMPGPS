package com.gpsromp.admin.service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.gpsromp.admin.dto.PosicionResumenResponse;
import com.gpsromp.admin.dto.PropietarioResumenResponse;
import com.gpsromp.admin.dto.VehiculoAdminResponse;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.gps.model.DispositivoGps;
import com.gpsromp.gps.model.GPSData;
import com.gpsromp.gps.repository.DispositivoGpsRepository;
import com.gpsromp.gps.service.GPSDataService;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Servicio de agregación y cálculo logístico para el panel de administración.
 *
 * Centraliza la resolución de reglas de negocio en el Backend:
 * 1. Búsqueda y paginación de vehículos (PostgreSQL).
 * 2. Carga en lote de propietarios en 1 sola consulta SQL (WHERE id IN ...).
 * 3. Carga en lote de telemetría GPS (Redis / MongoDB).
 * 4. Carga en lote de metadata de dispositivos GPS (SIM Card, operador) desde MongoDB.
 * 5. Cálculo logístico de estado de rastreo ("marcha", "detenido", "sin", "nogps", "off").
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class AdminVehiculoService {

    private final VehiculoRepository vehiculoRepository;
    private final UsuarioRepository usuarioRepository;
    private final GPSDataService gpsDataService;
    private final DispositivoGpsRepository dispositivoGpsRepository;

    /** Umbral de 5 minutos: si no reporta en este tiempo con velocidad > 0 deja de estar en marcha. */
    public static final long MS_EN_MARCHA = 5 * 60 * 1000L;

    public Page<VehiculoAdminResponse> buscar(String busqueda, Boolean activo, UUID idUsuario, Pageable pageable) {
        String texto = (busqueda == null) ? "" : busqueda.trim();
        Page<Vehiculo> pagina = vehiculoRepository.buscar(texto, activo, idUsuario, pageable);
        List<Vehiculo> vehiculos = pagina.getContent();

        if (vehiculos.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, pagina.getTotalElements());
        }

        // 1. Obtener propietarios en un solo batch
        Set<UUID> idsUsuarios = vehiculos.stream()
                .map(Vehiculo::getId_usuario)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, Usuario> mapaUsuarios = idsUsuarios.isEmpty()
                ? Map.of()
                : usuarioRepository.findAllById(idsUsuarios).stream()
                        .collect(Collectors.toMap(Usuario::getId, u -> u));

        // 2. Obtener posiciones GPS en batch (Redis + Mongo)
        Set<String> imeis = vehiculos.stream()
                .map(Vehiculo::getImei)
                .filter(imei -> imei != null && !imei.isBlank())
                .collect(Collectors.toSet());

        Map<String, GPSData> mapaGps = gpsDataService.getLastPositions(imeis);

        // 3. Obtener dispositivos GPS (con SIM Card) desde MongoDB
        Map<String, DispositivoGps> mapaDispositivos = imeis.isEmpty()
                ? Map.of()
                : dispositivoGpsRepository.findAllByImeiIn(imeis).stream()
                        .collect(Collectors.toMap(DispositivoGps::getImei, d -> d, (existente, reemplazo) -> existente));

        // 4. Resolver logística y cálculos para cada unidad
        Instant ahora = Instant.now();
        List<VehiculoAdminResponse> respuestas = vehiculos.stream()
                .map(v -> {
                    Usuario duennio = v.getId_usuario() != null ? mapaUsuarios.get(v.getId_usuario()) : null;
                    GPSData pos = v.getImei() != null ? mapaGps.get(v.getImei()) : null;
                    DispositivoGps disp = v.getImei() != null ? mapaDispositivos.get(v.getImei()) : null;
                    return mapearVehiculoAdmin(v, duennio, pos, disp, ahora);
                })
                .toList();

        return new PageImpl<>(respuestas, pageable, pagina.getTotalElements());
    }

    public VehiculoAdminResponse obtenerPorIdOFallar(UUID id) {
        Vehiculo v = vehiculoRepository.findById(id)
                .orElseThrow(() -> RecursoNoEncontradoException.vehiculo(id));

        Usuario duennio = v.getId_usuario() != null
                ? usuarioRepository.findById(v.getId_usuario()).orElse(null)
                : null;

        GPSData pos = (v.getImei() != null && !v.getImei().isBlank())
                ? gpsDataService.getLastPosition(v.getImei()).orElse(null)
                : null;

        DispositivoGps disp = (v.getImei() != null && !v.getImei().isBlank())
                ? dispositivoGpsRepository.findByImei(v.getImei()).orElse(null)
                : null;

        return mapearVehiculoAdmin(v, duennio, pos, disp, Instant.now());
    }

    /**
     * Regla logística de estado del vehículo:
     * - "nogps": Si no tiene IMEI asignado.
     * - "off": Si el vehículo está inactivo en el sistema.
     * - "sin": Si tiene IMEI pero nunca ha registrado posición.
     * - "marcha": Si velocidad > 0 y la posición fue reportada en los últimos 5 minutos.
     * - "detenido": Si velocidad == 0 o lleva más de 5 minutos sin reportar.
     */
    public String calcularEstado(Vehiculo v, GPSData pos, Instant ahora) {
        if (v.getImei() == null || v.getImei().isBlank()) {
            return "nogps";
        }
        if (Boolean.FALSE.equals(v.getActivo())) {
            return "off";
        }
        if (pos == null) {
            return "sin";
        }
        Instant fechaPos = pos.getRegistradoEn() != null ? pos.getRegistradoEn() : pos.getCreadosEn();
        long diferenciaMs = (fechaPos != null)
                ? Math.max(0, ahora.toEpochMilli() - fechaPos.toEpochMilli())
                : Long.MAX_VALUE;

        return (pos.getVelocidad() > 0 && diferenciaMs < MS_EN_MARCHA) ? "marcha" : "detenido";
    }

    public String resolverNombrePropietario(UUID idUsuario, Usuario u) {
        if (idUsuario == null) {
            return "Sin asignar";
        }
        if (u == null) {
            return "Propietario no disponible";
        }
        String nombre = u.getNombre() != null ? u.getNombre().trim() : "";
        String apellido = u.getApellido() != null ? u.getApellido().trim() : "";
        String completo = (nombre + " " + apellido).trim();
        if (!completo.isEmpty()) {
            return completo;
        }
        return u.getUsuario() != null ? u.getUsuario() : "Sin asignar";
    }

    public VehiculoAdminResponse mapearVehiculoAdmin(Vehiculo v, Usuario u, GPSData pos, DispositivoGps disp, Instant ahora) {
        String estado = calcularEstado(v, pos, ahora);
        String nombrePropietario = resolverNombrePropietario(v.getId_usuario(), u);
        PropietarioResumenResponse prop = PropietarioResumenResponse.de(u);
        PosicionResumenResponse ultPos = PosicionResumenResponse.de(pos, ahora);
        String numeroSim = disp != null ? disp.getNumeroSim() : null;

        return new VehiculoAdminResponse(
                v.getId(),
                v.getPlaca(),
                v.getImei(),
                numeroSim,
                v.getModelo(),
                v.getTipo(),
                v.getActivo(),
                v.getId_usuario(),
                v.getCreadoEn(),
                v.getActualizadoEn(),
                estado,
                nombrePropietario,
                prop,
                ultPos
        );
    }
}
