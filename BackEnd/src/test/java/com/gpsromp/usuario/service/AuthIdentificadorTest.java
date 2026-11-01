package com.gpsromp.usuario.service;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.common.service.SmsService;
import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthIdentificadorTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private UsuarioService usuarioService;

    @Mock
    private ServicioAutenticacion servicioAutenticacion;

    @Mock
    private DosFactoresService dosFactoresService;

    @Mock
    private N8nNotificacionService n8nNotificacionService;

    @Mock
    private SmsService smsService;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private AuthEmailService authEmailService;

    private AuthSmsService authSmsService;

    private RecuperacionContrasenaService recuperacionContrasenaService;

    private Usuario usuarioPrueba;

    @BeforeEach
    void setUp() {
        usuarioPrueba = new Usuario();
        usuarioPrueba.setUsuario("yayzxer");
        usuarioPrueba.setCorreo("yayzxer@example.com");
        usuarioPrueba.setTelefono("573133657311");
        usuarioPrueba.setActivo(true);
        usuarioPrueba.setRol(Rol.USUARIO);
        usuarioPrueba.setDosFactoresActivo(false);

        authSmsService = new AuthSmsService(
                usuarioRepository,
                usuarioService,
                servicioAutenticacion,
                dosFactoresService,
                smsService,
                stringRedisTemplate,
                passwordEncoder
        );

        recuperacionContrasenaService = new RecuperacionContrasenaService(
                usuarioRepository,
                stringRedisTemplate,
                n8nNotificacionService,
                passwordEncoder
        );
    }

    @Test
    void authEmail_solicitarCodigo_usuarioExistente_enviaOtp() {
        when(usuarioService.buscarPorIdentificador("yayzxer")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(n8nNotificacionService.enviarCorreoOtp(anyString(), anyString(), anyString(), anyString(), anyInt())).thenReturn(true);

        Map<String, Object> resp = authEmailService.solicitarCodigo("yayzxer");

        assertTrue((Boolean) resp.get("exito"));
        assertNotNull(resp.get("destino"));
        assertEquals("yayzxer", resp.get("usuario"));
        verify(valueOperations).set(eq("otp:email:login:yayzxer"), anyString(), any());
    }

    @Test
    void authEmail_verificarCodigo_codigoCorrecto_emiteSesion() {
        when(usuarioService.buscarPorIdentificador("yayzxer")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("otp:email:login:yayzxer")).thenReturn("123456");
        SesionResponse sesionEsperada = SesionResponse.de("access", "refresh", "yayzxer", Rol.USUARIO, null, 3600000L);
        when(servicioAutenticacion.emitirSesion(usuarioPrueba)).thenReturn(sesionEsperada);

        SesionResponse resp = authEmailService.verificarCodigo("yayzxer", "123456");

        assertNotNull(resp);
        assertEquals("access", resp.token());
        verify(stringRedisTemplate).delete("otp:email:login:yayzxer");
    }

    @Test
    void authEmail_verificarCodigo_codigoInvalido_lanzaExcepcion() {
        when(usuarioService.buscarPorIdentificador("yayzxer")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("otp:email:login:yayzxer")).thenReturn("999999");

        assertThrows(OperacionNoPermitidaException.class, () ->
                authEmailService.verificarCodigo("yayzxer", "123456")
        );
    }

    @Test
    void authSms_solicitarCodigoIdentificador_resuelveTelefonoYEnviaSms() {
        when(usuarioService.buscarPorIdentificador("yayzxer")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(smsService.enviarSms(eq("573133657311"), anyString())).thenReturn(true);

        Map<String, Object> resp = authSmsService.solicitarCodigoIdentificador("yayzxer");

        assertTrue((Boolean) resp.get("exito"));
        assertEquals("573133657311", resp.get("telefono"));
        assertNotNull(resp.get("destino"));
        verify(valueOperations).set(eq("otp:phone:573133657311"), anyString(), any());
    }

    @Test
    void authSms_verificarCodigoIdentificador_validaYEmiteSesion() {
        when(usuarioService.buscarPorIdentificador("yayzxer")).thenReturn(Optional.of(usuarioPrueba));
        when(usuarioRepository.findByTelefono("573133657311")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get("otp:phone:573133657311")).thenReturn("654321");
        SesionResponse sesionEsperada = SesionResponse.de("tokenSms", "refreshSms", "yayzxer", Rol.USUARIO, null, 3600000L);
        when(servicioAutenticacion.emitirSesion(usuarioPrueba)).thenReturn(sesionEsperada);

        SesionResponse resp = authSmsService.verificarCodigoIdentificador("yayzxer", "654321");

        assertNotNull(resp);
        assertEquals("tokenSms", resp.token());
        verify(stringRedisTemplate).delete("otp:phone:573133657311");
    }

    @Test
    void recuperacion_solicitarCodigo_usuarioInexistente_lanzaRecursoNoEncontrado() {
        when(usuarioRepository.findByCorreoIgnoreCase("noexiste")).thenReturn(Optional.empty());
        when(usuarioRepository.findByUsuarioIgnoreCase("noexiste")).thenReturn(Optional.empty());

        assertThrows(RecursoNoEncontradoException.class, () ->
                recuperacionContrasenaService.solicitarRecuperacion("noexiste")
        );
    }

    @Test
    void recuperacion_solicitarCodigo_usuarioExistenteCaseInsensitive_enviaOtp() {
        when(usuarioRepository.findByCorreoIgnoreCase("YAYZXER")).thenReturn(Optional.empty());
        when(usuarioRepository.findByUsuarioIgnoreCase("YAYZXER")).thenReturn(Optional.of(usuarioPrueba));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(n8nNotificacionService.enviarCorreoOtp(anyString(), any(), anyString(), eq("RECUPERAR_PASSWORD"), eq(10))).thenReturn(true);

        boolean enviado = recuperacionContrasenaService.solicitarRecuperacion("YAYZXER");

        assertTrue(enviado);
        verify(valueOperations).set(eq("otp:recuperar:code:yayzxer@example.com"), anyString(), any());
    }
}
