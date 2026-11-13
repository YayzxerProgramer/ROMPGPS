package com.gpsromp.vehiculo.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

@ExtendWith(MockitoExtension.class)
class AlertaDocumentosVehiculoServiceTest {

    @Mock
    private VehiculoRepository vehiculoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private N8nNotificacionService notificacionService;

    private AlertaDocumentosVehiculoService alertaService;

    @BeforeEach
    void setUp() {
        alertaService = new AlertaDocumentosVehiculoService(vehiculoRepository, usuarioRepository, notificacionService);
    }

    @Test
    void procesarAlertas_VehiculoConSoatA30Dias_DespachaAlerta() {
        LocalDate hoy = LocalDate.of(2026, 11, 13);
        UUID usuarioId = UUID.randomUUID();

        Usuario usuario = new Usuario();
        usuario.setId(usuarioId);
        usuario.setNombre("Carlos");
        usuario.setCorreo("carlos@example.com");
        usuario.setTelefono("3001234567");
        usuario.setActivo(true);

        Vehiculo vehiculo = Vehiculo.builder()
                .id(UUID.randomUUID())
                .placa("XYZ123")
                .modelo("Yamaha MT-07")
                .tipo("MOTO")
                .activo(true)
                .id_usuario(usuarioId)
                .fechaVencimientoSoat(hoy.plusDays(30)) // Umbral exacto de 30 días
                .build();

        when(vehiculoRepository.findVehiculosActivosConDocumentos()).thenReturn(List.of(vehiculo));
        when(usuarioRepository.findById(usuarioId)).thenReturn(Optional.of(usuario));

        int despachadas = alertaService.procesarAlertas(hoy);

        assertEquals(1, despachadas);
        verify(notificacionService, times(1)).despacharAlertaTelematica(
                eq("VENCIMIENTO_SOAT"),
                eq("WHATSAPP"),
                eq("3001234567"),
                eq("carlos@example.com"),
                eq("Carlos"),
                anyMap()
        );
    }

    @Test
    void procesarAlertas_VehiculoConDocumentosLejanos_NoDespacha() {
        LocalDate hoy = LocalDate.of(2026, 11, 13);
        UUID usuarioId = UUID.randomUUID();

        Usuario usuario = new Usuario();
        usuario.setId(usuarioId);
        usuario.setNombre("Ana");
        usuario.setCorreo("ana@example.com");
        usuario.setActivo(true);

        Vehiculo vehiculo = Vehiculo.builder()
                .id(UUID.randomUUID())
                .placa("ABC789")
                .modelo("Renault Logan")
                .tipo("CARRO")
                .activo(true)
                .id_usuario(usuarioId)
                .fechaVencimientoSoat(hoy.plusDays(100)) // Lejos de cualquier umbral
                .fechaVencimientoTecnomecanica(hoy.plusDays(80))
                .build();

        when(vehiculoRepository.findVehiculosActivosConDocumentos()).thenReturn(List.of(vehiculo));
        when(usuarioRepository.findById(usuarioId)).thenReturn(Optional.of(usuario));

        int despachadas = alertaService.procesarAlertas(hoy);

        assertEquals(0, despachadas);
        verifyNoInteractions(notificacionService);
    }
}
