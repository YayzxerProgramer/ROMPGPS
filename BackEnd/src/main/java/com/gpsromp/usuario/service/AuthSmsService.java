package com.gpsromp.usuario.service;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.common.service.SmsService;
import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.model.Rol;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Servicio para autenticación sin contraseña mediante OTP enviada por SMS.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthSmsService {

    private final UsuarioRepository usuarioRepository;
    private final UsuarioService usuarioService;
    private final ServicioAutenticacion servicioAutenticacion;
    private final DosFactoresService dosFactoresService;
    private final SmsService smsService;
    private final StringRedisTemplate stringRedisTemplate;
    private final PasswordEncoder passwordEncoder;

    private static final String REDIS_OTP_PREFIX = "otp:phone:";
    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Genera un código OTP de 6 dígitos, lo almacena en Redis (expira en 5 minutos)
     * y envía el SMS vía Hablame.co / SmsService.
     */
    public boolean solicitarCodigo(String telefono) {
        String telefonoLimpio = normalizarTelefono(telefono);
        String codigo = String.format("%06d", RANDOM.nextInt(1000000));
        String redisKey = REDIS_OTP_PREFIX + telefonoLimpio;

        stringRedisTemplate.opsForValue().set(redisKey, codigo, Duration.ofMinutes(5));

        String mensaje = "Tu codigo de verificacion para RompGPS es: " + codigo + ". Valido por 5 minutos.";
        log.info("Generado OTP para {}: {}", telefonoLimpio, codigo);

        return smsService.enviarSms(telefonoLimpio, mensaje);
    }

    /**
     * Solicita un código OTP resolviendo primero el usuario por su identificador
     * (usuario, correo o teléfono).
     */
    public Map<String, Object> solicitarCodigoIdentificador(String identificador) {
        if (identificador == null || identificador.isBlank()) {
            throw new OperacionNoPermitidaException("Debes ingresar tu usuario, correo o teléfono");
        }

        String idTrim = identificador.trim();
        Optional<Usuario> usuarioOpt = usuarioService.buscarPorIdentificador(idTrim);

        String telefonoDestino = null;
        String nombreUsuario = null;

        if (usuarioOpt.isPresent()) {
            Usuario u = usuarioOpt.get();
            if (u.getTelefono() == null || u.getTelefono().isBlank()) {
                throw new OperacionNoPermitidaException("El usuario no tiene un número celular registrado en su cuenta");
            }
            telefonoDestino = u.getTelefono();
            nombreUsuario = u.getUsuario();
        } else {
            String soloDigitos = idTrim.replaceAll("[^0-9]", "");
            if (soloDigitos.length() >= 7) {
                telefonoDestino = idTrim;
            } else {
                throw new RecursoNoEncontradoException("No se encontró ningún usuario con los datos ingresados");
            }
        }

        String telefonoLimpio = normalizarTelefono(telefonoDestino);
        String codigo = String.format("%06d", RANDOM.nextInt(1000000));
        String redisKey = REDIS_OTP_PREFIX + telefonoLimpio;

        stringRedisTemplate.opsForValue().set(redisKey, codigo, Duration.ofMinutes(5));
        String mensaje = "Tu codigo de verificacion para RompGPS es: " + codigo + ". Valido por 5 minutos.";
        log.info("Generado OTP SMS para {}: {}", telefonoLimpio, codigo);

        boolean enviado = smsService.enviarSms(telefonoLimpio, mensaje);

        return Map.of(
                "exito", enviado,
                "mensaje", enviado ? "Código OTP enviado por SMS" : "No se pudo enviar el SMS",
                "destino", enmascararTelefono(telefonoDestino),
                "telefono", telefonoLimpio,
                "usuario", nombreUsuario != null ? nombreUsuario : ""
        );
    }

    /**
     * Verifica el código OTP recibido contra Redis. Si es válido, busca el usuario por teléfono
     * o crea una nueva cuenta de usuario asignada a ese celular. Emite un token JWT de sesión.
     */
    public SesionResponse verificarCodigo(String telefono, String codigo) {
        String telefonoLimpio = normalizarTelefono(telefono);
        String redisKey = REDIS_OTP_PREFIX + telefonoLimpio;

        String otpGuardado = stringRedisTemplate.opsForValue().get(redisKey);
        if (otpGuardado == null || !otpGuardado.equals(codigo)) {
            throw new OperacionNoPermitidaException("Código OTP inválido o expirado");
        }

        stringRedisTemplate.delete(redisKey);

        Optional<Usuario> usuarioOpt = usuarioRepository.findByTelefono(telefonoLimpio);
        Usuario usuario;

        if (usuarioOpt.isPresent()) {
            usuario = usuarioOpt.get();
        } else {
            String usernameGen = "user_" + telefonoLimpio;
            String emailGen = telefonoLimpio + "@sms.rompgps.local";

            usuario = new Usuario();
            usuario.setNombre("Usuario");
            usuario.setApellido("SMS");
            usuario.setUsuario(usernameGen);
            usuario.setCorreo(emailGen);
            usuario.setTelefono(telefonoLimpio);
            usuario.setContrasena(passwordEncoder.encode(UUID.randomUUID().toString()));
            usuario.setRol(Rol.USUARIO);
            usuario.setActivo(true);

            usuario = usuarioRepository.save(usuario);
            log.info("Nuevo usuario creado vía SMS OTP: {}", usernameGen);
        }

        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new OperacionNoPermitidaException("La cuenta está desactivada");
        }

        if (Boolean.TRUE.equals(usuario.getDosFactoresActivo())) {
            return dosFactoresService.iniciarDesafioLogin(usuario);
        }

        return servicioAutenticacion.emitirSesion(usuario);
    }

    /**
     * Verifica el código OTP usando un identificador general o teléfono.
     */
    public SesionResponse verificarCodigoIdentificador(String identificador, String codigo) {
        if (identificador == null || identificador.isBlank() || codigo == null || codigo.isBlank()) {
            throw new OperacionNoPermitidaException("Faltan datos para verificar el código SMS");
        }

        String idTrim = identificador.trim();
        Optional<Usuario> usuarioOpt = usuarioService.buscarPorIdentificador(idTrim);

        String telefonoLimpio;
        if (usuarioOpt.isPresent()) {
            Usuario u = usuarioOpt.get();
            if (u.getTelefono() == null || u.getTelefono().isBlank()) {
                throw new OperacionNoPermitidaException("El usuario no tiene teléfono registrado");
            }
            telefonoLimpio = normalizarTelefono(u.getTelefono());
        } else {
            telefonoLimpio = normalizarTelefono(idTrim);
        }

        return verificarCodigo(telefonoLimpio, codigo);
    }

    private String enmascararTelefono(String telefono) {
        if (telefono == null || telefono.length() < 4) return "****";
        String limpio = telefono.replaceAll("[^0-9+]", "");
        int len = limpio.length();
        if (len <= 4) return "****";
        return limpio.substring(0, Math.min(len, 6)) + " *** **" + limpio.substring(len - 2);
    }

    private String normalizarTelefono(String telefono) {
        if (telefono == null) return "";
        String limpio = telefono.replaceAll("[^0-9]", "");
        if (!limpio.startsWith("57") && limpio.length() == 10) {
            limpio = "57" + limpio;
        }
        return limpio;
    }
}
