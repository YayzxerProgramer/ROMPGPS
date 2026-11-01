package com.gpsromp.gps.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gpsromp.gps.dto.DispositivoGpsDto;
import com.gpsromp.gps.dto.GuardarDispositivoGpsRequest;
import com.gpsromp.gps.model.DispositivoGps;
import com.gpsromp.gps.repository.DispositivoGpsRepository;

@ExtendWith(MockitoExtension.class)
class DispositivoGpsServiceTest {

    @Mock
    private DispositivoGpsRepository dispositivoGpsRepository;

    private DispositivoGpsService dispositivoGpsService;

    @BeforeEach
    void setUp() {
        dispositivoGpsService = new DispositivoGpsService(dispositivoGpsRepository);
    }

    @Test
    void guardarOActualizar_DispositivoNuevo_CreaEnMongo() {
        String imei = "123456789012345";
        GuardarDispositivoGpsRequest request = new GuardarDispositivoGpsRequest(
                imei, "+573133657311", "GT06", "Claro", true
        );

        when(dispositivoGpsRepository.findByImei(imei)).thenReturn(Optional.empty());
        when(dispositivoGpsRepository.save(any(DispositivoGps.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        DispositivoGpsDto resultado = dispositivoGpsService.guardarOActualizar(request);

        assertNotNull(resultado);
        assertEquals(imei, resultado.imei());
        assertEquals("+573133657311", resultado.numeroSim());
        assertEquals("GT06", resultado.modelo());
        assertEquals("Claro", resultado.operador());
        assertTrue(resultado.activo());
        verify(dispositivoGpsRepository).save(any(DispositivoGps.class));
    }

    @Test
    void actualizarSim_DispositivoExistente_ActualizaNumero() {
        String imei = "123456789012345";
        DispositivoGps existente = DispositivoGps.builder()
                .imei(imei)
                .numeroSim("+573000000000")
                .modelo("GT06")
                .build();

        when(dispositivoGpsRepository.findByImei(imei)).thenReturn(Optional.of(existente));
        when(dispositivoGpsRepository.save(any(DispositivoGps.class))).thenAnswer(inv -> inv.getArgument(0));

        DispositivoGpsDto resultado = dispositivoGpsService.actualizarSim(imei, "+573119998877");

        assertNotNull(resultado);
        assertEquals("+573119998877", resultado.numeroSim());
        verify(dispositivoGpsRepository).save(existente);
    }
}
