package com.gpsromp.vehiculo.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.config.SeguridadService;
import com.gpsromp.mantenimiento.service.MantenimientoService;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.dto.ActualizarVehiculoRequest;
import com.gpsromp.vehiculo.dto.CrearVehiculoRequest;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

@ExtendWith(MockitoExtension.class)
class VehiculoServiceImeiSecurityTest {

    @Mock
    private VehiculoRepository vehiculoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private MantenimientoService mantenimientoService;

    @Mock
    private SeguridadService seguridadService;

    private VehiculoService vehiculoService;

    @BeforeEach
    void setUp() {
        vehiculoService = new VehiculoService(vehiculoRepository, usuarioRepository, mantenimientoService, seguridadService);
    }

    @Test
    void crear_UsuarioNormalIntentaAsignarImei_LanzaOperacionNoPermitida() {
        UUID userId = UUID.randomUUID();
        CrearVehiculoRequest request = new CrearVehiculoRequest(
                "ABC123", "123456789012345", "Pulsar 200", "MOTO", true, userId
        );

        when(seguridadService.esAdminActual()).thenReturn(false);

        OperacionNoPermitidaException ex = assertThrows(
                OperacionNoPermitidaException.class,
                () -> vehiculoService.crear(request)
        );

        assertTrue(ex.getMessage().contains("Solo un administrador"));
        verify(vehiculoRepository, never()).save(any());
    }

    @Test
    void crear_AdminAsignaImei_Permitido() {
        UUID userId = UUID.randomUUID();
        CrearVehiculoRequest request = new CrearVehiculoRequest(
                "ABC123", "123456789012345", "Pulsar 200", "MOTO", true, userId
        );

        when(seguridadService.esAdminActual()).thenReturn(true);
        when(vehiculoRepository.existsByPlaca("ABC123")).thenReturn(false);
        when(vehiculoRepository.existsByImei("123456789012345")).thenReturn(false);
        when(usuarioRepository.existsById(userId)).thenReturn(true);
        when(vehiculoRepository.save(any(Vehiculo.class))).thenAnswer(inv -> inv.getArgument(0));

        Vehiculo creado = vehiculoService.crear(request);

        assertNotNull(creado);
        assertEquals("123456789012345", creado.getImei());
        verify(vehiculoRepository).save(any(Vehiculo.class));
    }

    @Test
    void actualizar_UsuarioNormalIntentaCambiarImei_LanzaOperacionNoPermitida() {
        UUID id = UUID.randomUUID();
        Vehiculo vehiculoExistente = Vehiculo.builder()
                .id(id)
                .placa("ABC123")
                .imei("111111111111111")
                .modelo("Pulsar 200")
                .tipo("MOTO")
                .build();

        ActualizarVehiculoRequest request = new ActualizarVehiculoRequest(
                null, "999999999999999", null, null, null
        );

        when(vehiculoRepository.findById(id)).thenReturn(Optional.of(vehiculoExistente));
        when(seguridadService.esAdminActual()).thenReturn(false);

        OperacionNoPermitidaException ex = assertThrows(
                OperacionNoPermitidaException.class,
                () -> vehiculoService.actualizar(id, request)
        );

        assertTrue(ex.getMessage().contains("Solo un administrador puede modificar el IMEI"));
    }

    @Test
    void actualizar_UsuarioNormalActualizaSinModificarImei_Permitido() {
        UUID id = UUID.randomUUID();
        Vehiculo vehiculoExistente = Vehiculo.builder()
                .id(id)
                .placa("ABC123")
                .imei("111111111111111")
                .modelo("Pulsar 200")
                .tipo("MOTO")
                .build();

        ActualizarVehiculoRequest request = new ActualizarVehiculoRequest(
                null, "111111111111111", "Pulsar NS 200 FI", null, null
        );

        when(vehiculoRepository.findById(id)).thenReturn(Optional.of(vehiculoExistente));
        when(vehiculoRepository.save(any(Vehiculo.class))).thenAnswer(inv -> inv.getArgument(0));

        Vehiculo actualizado = vehiculoService.actualizar(id, request);

        assertNotNull(actualizado);
        assertEquals("Pulsar NS 200 FI", actualizado.getModelo());
        assertEquals("111111111111111", actualizado.getImei());
        verify(vehiculoRepository).save(vehiculoExistente);
    }
}
