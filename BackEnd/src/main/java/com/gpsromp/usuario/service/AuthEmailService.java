package com.gpsromp.usuario.service;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.model.Usuario;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthEmailService {

    private final UsuarioService usuarioService;
    private final ServicioAutenticacion servicioAutenticacion;
    private final DosFactoresService dosFactoresService;
    private final N8nNotificacionService n8nNotificacionService;
    private final StringRedisTemplate stringRedisTemplate;

    private static final String REDIS_EMAIL_OTP_PREFIX = "otp:email:login:";
    private static final SecureRandom RANDOM = new SecureRandom();

    public Map<String, Object> solicitarCodigo(String identificador) {
        if (identificador == null || identificador.isBlank()) {
            throw new OperacionNoPermitidaException("Debes ingresar tu usuario, correo o teléfono");
        }

        Usuario usuario = usuarioService.buscarPorIdentificador(identificador)
                .orElseThrow(() -> new RecursoNoEncontradoException("No se encontró ningún usuario con los datos ingresados"));

        if (usuario.getCorreo() == null || usuario.getCorreo().isBlank()) {
            throw new OperacionNoPermitidaException("El usuario no tiene un correo electrónico configurado");
        }

        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new OperacionNoPermitidaException("La cuenta se encuentra desactivada");
        }

        String codigo = String.format("%06d", RANDOM.nextInt(1000000));
        String redisKey = REDIS_EMAIL_OTP_PREFIX + usuario.getUsuario().toLowerCase();

        stringRedisTemplate.opsForValue().set(redisKey, codigo, Duration.ofMinutes(5));

        log.info("Código OTP generado para inicio de sesión por correo de '{}': {}", usuario.getUsuario(), codigo);

        boolean enviado = n8nNotificacionService.enviarCorreoOtp(
                usuario.getCorreo(),
                usuario.getUsuario(),
                codigo,
                "LOGIN_OTP",
                5
        );

        return Map.of(
                "exito", enviado,
                "mensaje", "Código de verificación enviado a tu correo",
                "destino", enmascararCorreo(usuario.getCorreo()),
                "usuario", usuario.getUsuario()
        );
    }

    public SesionResponse verificarCodigo(String identificador, String codigo) {
        if (identificador == null || identificador.isBlank() || codigo == null || codigo.isBlank()) {
            throw new OperacionNoPermitidaException("Faltan parámetros para verificar el código");
        }

        Usuario usuario = usuarioService.buscarPorIdentificador(identificador)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado"));

        String redisKey = REDIS_EMAIL_OTP_PREFIX + usuario.getUsuario().toLowerCase();
        String otpGuardado = stringRedisTemplate.opsForValue().get(redisKey);

        if (otpGuardado == null || !otpGuardado.equals(codigo.trim())) {
            throw new OperacionNoPermitidaException("Código de correo inválido o expirado");
        }

        stringRedisTemplate.delete(redisKey);

        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new OperacionNoPermitidaException("La cuenta está desactivada");
        }

        if (Boolean.TRUE.equals(usuario.getDosFactoresActivo())) {
            return dosFactoresService.iniciarDesafioLogin(usuario);
        }

        return servicioAutenticacion.emitirSesion(usuario);
    }

    private String enmascararCorreo(String correo) {
        if (correo == null || !correo.contains("@")) return "***";
        String[] partes = correo.split("@", 2);
        String nombre = partes[0];
        String dominio = partes[1];
        if (nombre.length() <= 2) {
            return nombre.charAt(0) + "***@" + dominio;
        }
        return nombre.charAt(0) + "***" + nombre.charAt(nombre.length() - 1) + "@" + dominio;
    }
}
