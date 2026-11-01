package com.gpsromp.gps.service;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.gps.dto.DispositivoGpsDto;
import com.gpsromp.gps.dto.GuardarDispositivoGpsRequest;
import com.gpsromp.gps.model.DispositivoGps;
import com.gpsromp.gps.repository.DispositivoGpsRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class DispositivoGpsService {

    private final DispositivoGpsRepository dispositivoGpsRepository;

    public List<DispositivoGpsDto> obtenerTodos() {
        return dispositivoGpsRepository.findAll().stream()
                .map(DispositivoGpsDto::de)
                .toList();
    }

    public Optional<DispositivoGps> obtenerEntidadPorImei(String imei) {
        if (imei == null || imei.isBlank()) return Optional.empty();
        return dispositivoGpsRepository.findByImei(imei.trim());
    }

    public Optional<DispositivoGpsDto> obtenerPorImei(String imei) {
        return obtenerEntidadPorImei(imei).map(DispositivoGpsDto::de);
    }

    public DispositivoGpsDto obtenerPorImeiOFallar(String imei) {
        return obtenerPorImei(imei)
                .orElseThrow(() -> new RecursoNoEncontradoException("Dispositivo GPS no encontrado con IMEI: " + imei));
    }

    public Map<String, DispositivoGps> obtenerPorImeisIn(Collection<String> imeis) {
        if (imeis == null || imeis.isEmpty()) {
            return Map.of();
        }
        return dispositivoGpsRepository.findAllByImeiIn(imeis).stream()
                .collect(Collectors.toMap(DispositivoGps::getImei, d -> d, (existente, reemplazo) -> existente));
    }

    public DispositivoGpsDto guardarOActualizar(GuardarDispositivoGpsRequest peticion) {
        String imei = peticion.imei().trim();
        DispositivoGps dispositivo = dispositivoGpsRepository.findByImei(imei)
                .orElseGet(() -> DispositivoGps.builder()
                        .imei(imei)
                        .creadoEn(Instant.now())
                        .build());

        if (peticion.numeroSim() != null) {
            String simLimpio = peticion.numeroSim().trim();
            dispositivo.setNumeroSim(simLimpio.isEmpty() ? null : simLimpio);
        }
        if (peticion.modelo() != null && !peticion.modelo().isBlank()) {
            dispositivo.setModelo(peticion.modelo().trim());
        }
        if (peticion.operador() != null) {
            dispositivo.setOperador(peticion.operador().trim());
        }
        if (peticion.activo() != null) {
            dispositivo.setActivo(peticion.activo());
        }
        dispositivo.setActualizadoEn(Instant.now());

        DispositivoGps guardado = dispositivoGpsRepository.save(dispositivo);
        log.info("Dispositivo GPS con IMEI {} guardado/actualizado en MongoDB con SIM '{}'", imei, guardado.getNumeroSim());
        return DispositivoGpsDto.de(guardado);
    }

    public DispositivoGpsDto actualizarSim(String imei, String nuevoNumeroSim) {
        if (imei == null || imei.isBlank()) {
            throw new IllegalArgumentException("El IMEI es obligatorio");
        }
        String imeiLimpio = imei.trim();
        DispositivoGps dispositivo = dispositivoGpsRepository.findByImei(imeiLimpio)
                .orElseGet(() -> DispositivoGps.builder()
                        .imei(imeiLimpio)
                        .creadoEn(Instant.now())
                        .build());

        String simLimpio = nuevoNumeroSim != null ? nuevoNumeroSim.trim() : null;
        dispositivo.setNumeroSim(simLimpio == null || simLimpio.isEmpty() ? null : simLimpio);
        dispositivo.setActualizadoEn(Instant.now());

        DispositivoGps guardado = dispositivoGpsRepository.save(dispositivo);
        log.info("SIM Card actualizada para GPS IMEI {} -> SIM: {}", imeiLimpio, guardado.getNumeroSim());
        return DispositivoGpsDto.de(guardado);
    }

    public void eliminarPorImei(String imei) {
        dispositivoGpsRepository.findByImei(imei).ifPresent(dispositivoGpsRepository::delete);
    }
}
