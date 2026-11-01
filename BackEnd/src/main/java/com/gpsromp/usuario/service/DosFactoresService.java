package com.gpsromp.usuario.service;

import com.gpsromp.common.exception.OperacionNoPermitidaException;
import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.common.service.N8nNotificacionService;
import com.gpsromp.common.service.SmsService;
import com.gpsromp.config.JwtUtil;
import com.gpsromp.config.ServicioTokens;
import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.model.Canal2fa;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.UUID;

/**
 * Gestión del ciclo de vida de autenticación en dos factores (2FA).
 * Utiliza Redis para almacenamiento efímero y TTL estricto de códigos y tickets.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class DosFactoresService {

    private final StringRedisTemplate stringRedisTemplate;
    private final SmsService smsService;
    private final N8nNotificacionService n8nNotificacionService;
    private final UsuarioRepository usuarioRepository;
    private final JwtUtil jwtUtil;
    private final ServicioTokens servicioTokens;

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration TTL_2FA = Duration.ofMinutes(5);

    private static final String REDIS_PREFIX_CODE = "otp:2fa:ticket:code:";
    private static final String REDIS_PREFIX_USER = "otp:2fa:ticket:user:";
    private static final String REDIS_PREFIX_CHANNEL = "otp:2fa:ticket:channel:";

    /**
     * Inicia el desafío 2FA para un usuario tras validar sus credenciales.
     */
    public SesionResponse iniciarDesafioLogin(Usuario usuario) {
        String ticket2FA = UUID.randomUUID().toString();
        String codigo = String.format("%06d", RANDOM.nextInt(1000000));
        Canal2fa canal = usuario.getCanal2fa() != null ? usuario.getCanal2fa() : Canal2fa.CORREO;

        // Guardar estado en Redis con expiración automática de 5 minutos
        stringRedisTemplate.opsForValue().set(REDIS_PREFIX_CODE + ticket2FA, codigo, TTL_2FA);
        stringRedisTemplate.opsForValue().set(REDIS_PREFIX_USER + ticket2FA, usuario.getUsuario(), TTL_2FA);
        stringRedisTemplate.opsForValue().set(REDIS_PREFIX_CHANNEL + ticket2FA, canal.name(), TTL_2FA);

        // Despachar el código según el canal preferido
        despacharCodigoPorCanal(canal, usuario, codigo);

        String destinoEnmascarado = enmascararDestino(canal, usuario.getCorreo(), usuario.getTelefono());
        log.info("Desafío 2FA generado para usuario '{}' por canal {} hacia {}. [OTP CÓDIGO ACTIVO: {}]", usuario.getUsuario(), canal, destinoEnmascarado, codigo);

        return SesionResponse.desafio2fa(usuario.getUsuario(), ticket2FA, canal, destinoEnmascarado);
    }

    /**
     * Permite cambiar de canal durante el inicio de sesión (ej: pasar de Correo a SMS o WhatsApp).
     */
    public SesionResponse cambiarCanalDesafio(String ticket2FA, Canal2fa nuevoCanal) {
        String username = stringRedisTemplate.opsForValue().get(REDIS_PREFIX_USER + ticket2FA);
        String codigo = stringRedisTemplate.opsForValue().get(REDIS_PREFIX_CODE + ticket2FA);

        if (username == null || codigo == null) {
            throw new OperacionNoPermitidaException("El desafío 2FA ha expirado o no es válido");
        }

        Usuario usuario = usuarioRepository.findByUsuario(username)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado"));

        validarDisponibilidadCanal(nuevoCanal, usuario);

        stringRedisTemplate.opsForValue().set(REDIS_PREFIX_CHANNEL + ticket2FA, nuevoCanal.name(), TTL_2FA);
        despacharCodigoPorCanal(nuevoCanal, usuario, codigo);

        String destinoEnmascarado = enmascararDestino(nuevoCanal, usuario.getCorreo(), usuario.getTelefono());
        log.info("Canal de desafío 2FA cambiado a {} para usuario '{}'. [OTP CÓDIGO ACTIVO: {}]", nuevoCanal, username, codigo);

        return SesionResponse.desafio2fa(usuario.getUsuario(), ticket2FA, nuevoCanal, destinoEnmascarado);
    }

    /**
     * Valida el código 2FA ingresado y emite la sesión definitiva si es correcto.
     */
    public SesionResponse verificarDesafioLogin(String ticket2FA, String codigoIngresado) {
        String codigoGuardado = stringRedisTemplate.opsForValue().get(REDIS_PREFIX_CODE + ticket2FA);
        String username = stringRedisTemplate.opsForValue().get(REDIS_PREFIX_USER + ticket2FA);

        if (codigoGuardado == null || username == null) {
            throw new OperacionNoPermitidaException("El código 2FA ha expirado o el ticket es inválido");
        }

        if (!codigoGuardado.equals(codigoIngresado.trim())) {
            throw new OperacionNoPermitidaException("Código de verificación incorrecto");
        }

        // Eliminar llaves de Redis tras uso exitoso (prevención de replay)
        stringRedisTemplate.delete(REDIS_PREFIX_CODE + ticket2FA);
        stringRedisTemplate.delete(REDIS_PREFIX_USER + ticket2FA);
        stringRedisTemplate.delete(REDIS_PREFIX_CHANNEL + ticket2FA);

        Usuario usuario = usuarioRepository.findByUsuario(username)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado"));

        log.info("Verificación 2FA exitosa para usuario '{}'", username);
        return emitirSesion(usuario);
    }

    public SesionResponse emitirSesion(Usuario usuario) {
        String acceso = jwtUtil.generarAccessToken(usuario.getUsuario(), usuario.getRol().name());
        String jti = servicioTokens.nuevoJti();
        String refresco = jwtUtil.generarRefreshToken(usuario.getUsuario(), jti);
        servicioTokens.registrar(jti, usuario.getUsuario(), jwtUtil.getExpiracionRefrescoMs());
        return SesionResponse.de(acceso, refresco, usuario.getUsuario(), usuario.getRol(), usuario.getPlan(), jwtUtil.getExpiracionAccesoMs());
    }

    /**
     * Actualiza la configuración de 2FA en el perfil del usuario (activar/desactivar y canal).
     */
    public Usuario actualizarConfiguracion(Usuario usuario, Boolean activo, Canal2fa canal) {
        if (Boolean.TRUE.equals(activo)) {
            Canal2fa canalFinal = canal != null ? canal : usuario.getCanal2fa();
            validarDisponibilidadCanal(canalFinal, usuario);
            usuario.setDosFactoresActivo(true);
            usuario.setCanal2fa(canalFinal);
        } else {
            usuario.setDosFactoresActivo(false);
        }

        return usuarioRepository.save(usuario);
    }

    private void despacharCodigoPorCanal(Canal2fa canal, Usuario usuario, String codigo) {
        switch (canal) {
            case SMS -> {
                String mensaje = "Tu codigo de seguridad RompGPS es: " + codigo + ". Valido por 5 minutos.";
                smsService.enviarSms(usuario.getTelefono(), mensaje);
            }
            case WHATSAPP -> {
                String mensaje = "🔐 Tu código de verificación *RompGPS* es: *" + codigo + "* (Válido por 5 minutos).";
                smsService.enviarWhatsApp(usuario.getTelefono(), mensaje);
            }
            case CORREO -> n8nNotificacionService.enviarCorreoOtp(
                    usuario.getCorreo(),
                    usuario.getNombre(),
                    codigo,
                    "LOGIN_2FA",
                    5
            );
        }
    }

    private void validarDisponibilidadCanal(Canal2fa canal, Usuario usuario) {
        if (canal == Canal2fa.SMS || canal == Canal2fa.WHATSAPP) {
            if (usuario.getTelefono() == null || usuario.getTelefono().isBlank()) {
                throw new OperacionNoPermitidaException("Debes registrar un número de teléfono en tu perfil para usar 2FA por " + canal);
            }
        }
        if (canal == Canal2fa.CORREO) {
            if (usuario.getCorreo() == null || usuario.getCorreo().isBlank()) {
                throw new OperacionNoPermitidaException("Debes tener un correo registrado para usar 2FA por Correo");
            }
        }
    }

    private String enmascararDestino(Canal2fa canal, String correo, String telefono) {
        if (canal == Canal2fa.CORREO) {
            if (correo == null || !correo.contains("@")) return "tu correo";
            String[] partes = correo.split("@");
            String nombre = partes[0];
            String dominio = partes[1];
            String visible = nombre.length() <= 2 ? nombre : nombre.substring(0, 1) + "***" + nombre.substring(nombre.length() - 1);
            return visible + "@" + dominio;
        } else {
            if (telefono == null || telefono.length() < 4) return "tu celular";
            int len = telefono.length();
            return "+57 " + telefono.substring(0, 3) + " *** **" + telefono.substring(len - 2);
        }
    }
}
