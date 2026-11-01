package com.gpsromp.usuario.service;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Optional;

/**
 * Servicio para recuperación de contraseñas mediante código OTP enviado por correo vía n8n.
 * Los códigos se gestionan exclusivamente en Redis con TTL de 10 minutos.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class RecuperacionContrasenaService {

    private final UsuarioRepository usuarioRepository;
    private final StringRedisTemplate stringRedisTemplate;
    private final N8nNotificacionService n8nNotificacionService;
    private final PasswordEncoder passwordEncoder;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration TTL_RECUPERACION = Duration.ofMinutes(10);
    private static final String REDIS_PREFIX_RECUPERACION = "otp:recuperar:code:";

    /**
     * Genera un código OTP de recuperación y lo envía por correo al usuario vía n8n.
     */
    public boolean solicitarRecuperacion(String identificador) {
        if (identificador == null || identificador.isBlank()) {
            throw new IllegalArgumentException("Debes ingresar tu correo o nombre de usuario");
        }

        String limpio = identificador.trim();
        Optional<Usuario> usuarioOpt = usuarioRepository.findByCorreoIgnoreCase(limpio);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByUsuarioIgnoreCase(limpio);
        }

        if (usuarioOpt.isEmpty()) {
            log.warn("Solicitud de recuperación para identificador inexistente: {}", limpio);
            throw new com.gpsromp.common.exception.RecursoNoEncontradoException("No encontramos ningún usuario o correo con ese dato");
        }

        Usuario usuario = usuarioOpt.get();
        String codigo = String.format("%06d", RANDOM.nextInt(1000000));
        String redisKey = REDIS_PREFIX_RECUPERACION + usuario.getCorreo().toLowerCase();

        // Guardar código en Redis con expiración de 10 minutos
        stringRedisTemplate.opsForValue().set(redisKey, codigo, TTL_RECUPERACION);

        // Despachar hacia n8n para envío de correo
        n8nNotificacionService.enviarCorreoOtp(
                usuario.getCorreo(),
                usuario.getNombre(),
                codigo,
                "RECUPERAR_PASSWORD",
                10
        );

        log.info("Código de recuperación generado para usuario '{}' hacia {}", usuario.getUsuario(), usuario.getCorreo());
        return true;
    }

    /**
     * Valida si el código OTP coincide con el almacenado en Redis sin invalidarlo.
     * Permite al frontend validar el código antes de mostrar el formulario de nueva contraseña.
     */
    public boolean validarCodigo(String identificador, String codigo) {
        if (identificador == null || identificador.isBlank()) {
            throw new IllegalArgumentException("El identificador es obligatorio");
        }
        if (codigo == null || codigo.isBlank()) {
            throw new IllegalArgumentException("El código de recuperación es obligatorio");
        }

        String limpio = identificador.trim();
        Optional<Usuario> usuarioOpt = usuarioRepository.findByCorreoIgnoreCase(limpio);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByUsuarioIgnoreCase(limpio);
        }

        if (usuarioOpt.isEmpty()) {
            throw new OperacionNoPermitidaException("Código de recuperación inválido o expirado");
        }

        Usuario usuario = usuarioOpt.get();
        String redisKey = REDIS_PREFIX_RECUPERACION + usuario.getCorreo().toLowerCase();
        String codigoGuardado = stringRedisTemplate.opsForValue().get(redisKey);

        if (codigoGuardado == null || !codigoGuardado.equals(codigo.trim())) {
            throw new OperacionNoPermitidaException("Código de recuperación inválido o expirado");
        }

        return true;
    }

    /**
     * Valida el código OTP de Redis y actualiza la contraseña del usuario con hash BCrypt.
     */
    public boolean restablecerContrasena(String identificador, String codigo, String nuevaContrasena) {
        if (nuevaContrasena == null || nuevaContrasena.length() < 6) {
            throw new IllegalArgumentException("La nueva contraseña debe tener al menos 6 caracteres");
        }

        String limpio = identificador.trim();
        Optional<Usuario> usuarioOpt = usuarioRepository.findByCorreoIgnoreCase(limpio);
        if (usuarioOpt.isEmpty()) {
            usuarioOpt = usuarioRepository.findByUsuarioIgnoreCase(limpio);
        }

        if (usuarioOpt.isEmpty()) {
            throw new OperacionNoPermitidaException("Código de recuperación inválido o expirado");
        }

        Usuario usuario = usuarioOpt.get();
        String redisKey = REDIS_PREFIX_RECUPERACION + usuario.getCorreo().toLowerCase();
        String codigoGuardado = stringRedisTemplate.opsForValue().get(redisKey);

        if (codigoGuardado == null || !codigoGuardado.equals(codigo.trim())) {
            throw new OperacionNoPermitidaException("Código de recuperación inválido o expirado");
        }

        // Eliminar código de Redis
        stringRedisTemplate.delete(redisKey);

        // Actualizar contraseña con hash BCrypt
        usuario.setContrasena(passwordEncoder.encode(nuevaContrasena));
        usuarioRepository.save(usuario);

        log.info("Contraseña restablecida exitosamente para usuario '{}'", usuario.getUsuario());
        return true;
    }
}
