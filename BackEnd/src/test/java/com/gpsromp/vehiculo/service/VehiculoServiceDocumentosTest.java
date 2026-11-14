package com.gpsromp.vehiculo.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.gpsromp.config.SeguridadService;
import com.gpsromp.mantenimiento.service.MantenimientoService;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.vehiculo.dto.ActualizarVehiculoRequest;
import com.gpsromp.vehiculo.dto.CrearVehiculoRequest;
import com.gpsromp.vehiculo.dto.VehiculoMapper;
import com.gpsromp.vehiculo.dto.VehiculoResponse;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

@ExtendWith(MockitoExtension.class)
class VehiculoServiceDocumentosTest {

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
    void crear_ConFechasSoatYTecnomecanica_GuardaCorrectamente() {
        LocalDate soat = LocalDate.now().plusMonths(6);
        LocalDate tecno = LocalDate.now().plusMonths(10);
        UUID userId = UUID.randomUUID();

        CrearVehiculoRequest request = new CrearVehiculoRequest(
                "XYZ123", null, "Yamaha MT-07", "MOTO", true, userId, soat, tecno);

        when(vehiculoRepository.existsByPlaca("XYZ123")).thenReturn(false);
        when(usuarioRepository.existsById(userId)).thenReturn(true);
        when(vehiculoRepository.save(any(Vehiculo.class))).thenAnswer(inv -> inv.getArgument(0));

        Vehiculo creado = vehiculoService.crear(request);

        assertNotNull(creado);
        assertEquals("XYZ123", creado.getPlaca());
        assertEquals(soat, creado.getFechaVencimientoSoat());
        assertEquals(tecno, creado.getFechaVencimientoTecnomecanica());
    }

    @Test
    void actualizarDocumentos_CambiaFechasExitosamente() {
        UUID vehiculoId = UUID.randomUUID();
        Vehiculo existente = Vehiculo.builder()
                .id(vehiculoId)
                .placa("XYZ123")
                .modelo("Yamaha MT-07")
                .tipo("MOTO")
                .activo(true)
                .build();

        LocalDate nuevoSoat = LocalDate.now().plusDays(20);
        LocalDate nuevaTecno = LocalDate.now().plusYears(1);

        when(vehiculoRepository.findById(vehiculoId)).thenReturn(Optional.of(existente));
        when(vehiculoRepository.save(any(Vehiculo.class))).thenAnswer(inv -> inv.getArgument(0));

        Vehiculo actualizado = vehiculoService.actualizarDocumentos(vehiculoId, nuevoSoat, nuevaTecno);

        assertEquals(nuevoSoat, actualizado.getFechaVencimientoSoat());
        assertEquals(nuevaTecno, actualizado.getFechaVencimientoTecnomecanica());
    }

    @Test
    void vehiculoMapper_CalculaEstadosYDiasCorrectamente() {
        Vehiculo v = Vehiculo.builder()
                .id(UUID.randomUUID())
                .placa("ABC123")
                .modelo("Chevrolet Spark")
                .tipo("CARRO")
                .activo(true)
                .fechaVencimientoSoat(LocalDate.now().plusDays(15)) // Por vencer
                .fechaVencimientoTecnomecanica(LocalDate.now().minusDays(5)) // Vencido
                .build();

        VehiculoResponse resp = VehiculoMapper.aResponse(v);

        assertNotNull(resp);
        assertEquals("POR_VENCER", resp.estadoSoat());
        assertEquals(15L, resp.diasParaVencerSoat());

        assertEquals("VENCIDO", resp.estadoTecnomecanica());
        assertEquals(-5L, resp.diasParaVencerTecnomecanica());
    }

    @Test
    void vehiculoMapper_SinFechasRegistradas_RetornaNoRegistrado() {
        Vehiculo v = Vehiculo.builder()
                .id(UUID.randomUUID())
                .placa("ABC123")
                .modelo("Mazda 2")
                .tipo("CARRO")
                .activo(true)
                .build();

        VehiculoResponse resp = VehiculoMapper.aResponse(v);

        assertNotNull(resp);
        assertEquals("NO_REGISTRADO", resp.estadoSoat());
        assertNull(resp.diasParaVencerSoat());
        assertEquals("NO_REGISTRADO", resp.estadoTecnomecanica());
        assertNull(resp.diasParaVencerTecnomecanica());
    }
}
