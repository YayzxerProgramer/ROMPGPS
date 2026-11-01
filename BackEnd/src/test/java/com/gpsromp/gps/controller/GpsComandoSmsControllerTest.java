package com.gpsromp.gps.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.service.SmsService;
import com.gpsromp.gps.model.DispositivoGps;
import com.gpsromp.gps.repository.DispositivoGpsRepository;
import com.gpsromp.vehiculo.model.Vehiculo;
import com.gpsromp.vehiculo.repository.VehiculoRepository;

@ExtendWith(MockitoExtension.class)
class GpsComandoSmsControllerTest {

    @Mock
    private VehiculoRepository vehiculoRepository;

    @Mock
    private DispositivoGpsRepository dispositivoGpsRepository;

    @Mock
    private SmsService smsService;

    private GpsComandoSmsController controller;

    @BeforeEach
    void setUp() {
        controller = new GpsComandoSmsController(vehiculoRepository, dispositivoGpsRepository, smsService);
    }

    @Test
    void enviarComandoSms_CorteMotor_UsaSimDeMongoYNoExponeTelefono() {
        String imei = "123456789012345";
        Vehiculo vehiculo = Vehiculo.builder()
                .imei(imei)
                .placa("EXF06H")
                .modelo("Yamaha MT-03")
                .tipo("MOTO")
                .build();
        DispositivoGps dispositivo = DispositivoGps.builder()
                .imei(imei)
                .numeroSim("+573133657311")
                .build();

        when(vehiculoRepository.findByImei(imei)).thenReturn(Optional.of(vehiculo));
        when(dispositivoGpsRepository.findByImei(imei)).thenReturn(Optional.of(dispositivo));
        when(smsService.enviarSms("+573133657311", "#RELAY,1#")).thenReturn(true);

        GpsComandoSmsController.ComandoSmsRequest request = new GpsComandoSmsController.ComandoSmsRequest();
        request.setImei(imei);
        request.setComando("CORTE_MOTOR");

        ResponseEntity<Map<String, Object>> response = controller.enviarComandoSms(request);

        assertNotNull(response);
        assertEquals(200, response.getStatusCode().value());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);

        assertTrue((Boolean) body.get("exito"));
        assertEquals(imei, body.get("imei"));
        assertEquals("CORTE_MOTOR", body.get("comando"));
        // Comprobación de seguridad esencial: no exponer el número en la respuesta JSON
        assertFalse(body.containsKey("telefono"));
        assertFalse(body.containsKey("telefonoSim"));
        assertFalse(body.containsKey("numeroSim"));
        assertFalse(body.get("mensaje").toString().contains("3133657311"));

        verify(smsService).enviarSms("+573133657311", "#RELAY,1#");
    }

    @Test
    void enviarComandoSms_SinSimEnMongo_LanzaOperacionNoPermitida() {
        String imei = "123456789012345";
        Vehiculo vehiculo = Vehiculo.builder()
                .imei(imei)
                .placa("EXF06H")
                .modelo("Yamaha MT-03")
                .tipo("MOTO")
                .build();
        DispositivoGps dispositivoSinSim = DispositivoGps.builder()
                .imei(imei)
                .numeroSim(null)
                .build();

        when(vehiculoRepository.findByImei(imei)).thenReturn(Optional.of(vehiculo));
        when(dispositivoGpsRepository.findByImei(imei)).thenReturn(Optional.of(dispositivoSinSim));

        GpsComandoSmsController.ComandoSmsRequest request = new GpsComandoSmsController.ComandoSmsRequest();
        request.setImei(imei);
        request.setComando("CORTE_MOTOR");

        OperacionNoPermitidaException ex = assertThrows(
                OperacionNoPermitidaException.class,
                () -> controller.enviarComandoSms(request)
        );

        assertTrue(ex.getMessage().contains("SIM Card"));
        verify(smsService, never()).enviarSms(any(), any());
    }
}
