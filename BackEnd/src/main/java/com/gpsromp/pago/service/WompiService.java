package com.gpsromp.pago.service;

import com.gpsromp.common.exception.RecursoNoEncontradoException;
import com.gpsromp.pago.dto.ConfirmarCompraRequest;
import com.gpsromp.pago.dto.PrepararCheckoutResponse;
import com.gpsromp.pago.model.Pago;
import com.gpsromp.pago.model.Suscripcion;
import com.gpsromp.pago.repository.PagoRepository;
import com.gpsromp.pago.repository.SuscripcionRepository;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Usuario;
import com.gpsromp.usuario.repository.UsuarioRepository;
import com.gpsromp.venta.dto.VentaResponse;
import com.gpsromp.venta.model.Venta;
import com.gpsromp.venta.repository.VentaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class WompiService {

    private final PagoRepository pagoRepository;
    private final SuscripcionRepository suscripcionRepository;
    private final VentaRepository ventaRepository;
    private final UsuarioRepository usuarioRepository;

    @Value("${wompi.events.secret:test_events_secret_12345}")
    private String eventsSecret;

    @Value("${wompi.public-key:}")
    private String publicKey;

    @Value("${wompi.integrity-secret:}")
    private String integritySecret;

    /** Genera en el backend la referencia, el valor y la firma requeridos por Wompi. */
    public PrepararCheckoutResponse prepararCheckout(String planSolicitado, String periodoSolicitado) {
        if (publicKey.isBlank() || integritySecret.isBlank()) {
            String variablesFaltantes = String.join(", ", java.util.stream.Stream.of(
                    publicKey.isBlank() ? "WOMPI_PUBLIC_KEY" : null,
                    integritySecret.isBlank() ? "WOMPI_INTEGRITY_SECRET" : null)
                    .filter(java.util.Objects::nonNull)
                    .toList());
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "La pasarela no está configurada. Variables faltantes: " + variablesFaltantes
                            + ". Reinicia el backend después de actualizar el archivo .env.");
        }

        PlanTipo plan;
        try {
            plan = PlanTipo.valueOf(planSolicitado.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El plan solicitado no es válido.");
        }

        String periodo = periodoSolicitado.trim().toUpperCase();
        if (!periodo.equals("MENSUAL") && !periodo.equals("ANUAL")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El periodo debe ser MENSUAL o ANUAL.");
        }

        long precioMensual = switch (plan) {
            case PERSONAL -> 229_000L;
            case PRO -> 289_000L;
            case ENTERPRISE -> 339_000L;
        };
        long monto = periodo.equals("ANUAL") ? Math.round(precioMensual * 12 * 0.8) : precioMensual;
        long montoCentavos = monto * 100;
        String referencia = "ROMP-" + UUID.randomUUID() + "-" + plan.name() + "-" + periodo;
        String cadenaFirma = referencia + montoCentavos + "COP" + integritySecret;

        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(cadenaFirma.getBytes(StandardCharsets.UTF_8));
            return new PrepararCheckoutResponse(publicKey, referencia, montoCentavos, HexFormat.of().formatHex(hash));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("No fue posible preparar la firma de pago.", ex);
        }
    }

    /**
     * Confirmación directa de compra invocada por el frontend autenticado
     * tras la aprobación exitosa en la pasarela de pagos Wompi.
     */
    @Transactional
    public VentaResponse confirmarCompra(String nombreUsuario, ConfirmarCompraRequest req) {
        Usuario usuario = usuarioRepository.findByUsuario(nombreUsuario)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario no encontrado: " + nombreUsuario));

        // 1. Actualizar el plan del usuario en la base de datos
        usuario.setPlan(req.plan());
        usuarioRepository.save(usuario);
        log.info("Plan actualizado a {} para el usuario {} tras compra directa exitosa", req.plan(), usuario.getUsuario());

        // 2. Registrar o actualizar la Venta vinculada directamente al cliente
        Venta venta = ventaRepository.findByReferencia(req.referencia())
                .orElseGet(() -> Venta.builder()
                        .referencia(req.referencia())
                        .build());

        String nombreCompleto = ((usuario.getNombre() != null ? usuario.getNombre() : "") + " " +
                (usuario.getApellido() != null ? usuario.getApellido() : "")).trim();
        if (nombreCompleto.isBlank()) {
            nombreCompleto = usuario.getUsuario();
        }

        String periodo = req.periodo() != null && !req.periodo().isBlank() ? req.periodo().toUpperCase() : "MENSUAL";
        String metodoPago = req.metodoPago() != null && !req.metodoPago().isBlank() ? req.metodoPago().toUpperCase() : "WOMPI";

        venta.setUsuario(usuario);
        venta.setClienteNombre(nombreCompleto);
        venta.setClienteCorreo(usuario.getCorreo());
        venta.setPlan(req.plan());
        venta.setMonto(req.monto());
        venta.setPeriodo(periodo);
        venta.setEstado("APROBADO");
        venta.setMetodoPago(metodoPago);
        venta.setNotas("Compra directa online desde el sistema (Wompi Tx: " + (req.transaccionId() != null ? req.transaccionId() : "N/A") + ")");

        Venta guardada = ventaRepository.save(venta);
        log.info("Venta registrada exitosamente con ID {} y Referencia {}", guardada.getId(), guardada.getReferencia());

        // 3. Registrar o actualizar Pago si viene transaccionId
        if (req.transaccionId() != null && !req.transaccionId().isBlank()) {
            Pago pago = pagoRepository.findByTransaccionIdWompi(req.transaccionId())
                    .orElseGet(() -> Pago.builder()
                            .transaccionIdWompi(req.transaccionId())
                            .referenciaWompi(req.referencia())
                            .build());
            pago.setMonto(req.monto());
            pago.setMoneda("COP");
            pago.setEstado("APPROVED");
            pago.setMetodoPago(metodoPago);
            pagoRepository.save(pago);
        }

        return VentaResponse.de(guardada);
    }

    /**
     * Procesa el evento recibido por Webhook desde Wompi (transaction.updated).
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public boolean procesarWebhook(Map<String, Object> payload, String checksumHeader) {
        try {
            if (!validarFirmaEvento(payload, checksumHeader)) {
                log.warn("Webhook Wompi rechazado: checksum ausente o inválido");
                return false;
            }

            String event = (String) payload.get("event");
            if (!"transaction.updated".equals(event)) {
                log.info("Evento Wompi ignorado: {}", event);
                return true;
            }

            Map<String, Object> data = (Map<String, Object>) payload.get("data");
            if (data == null) return false;

            Map<String, Object> transaction = (Map<String, Object>) data.get("transaction");
            if (transaction == null) return false;

            String txId = (String) transaction.get("id");
            String status = (String) transaction.get("status");
            String reference = (String) transaction.get("reference");
            Number amountInCents = (Number) transaction.get("amount_in_cents");
            String currency = (String) transaction.get("currency");
            String paymentMethodType = (String) transaction.get("payment_method_type");
            String customerEmail = (String) transaction.get("customer_email");

            BigDecimal monto = BigDecimal.valueOf(amountInCents != null ? amountInCents.longValue() / 100.0 : 0);

            log.info("Transacción Wompi recibida por Webhook: ID={}, Ref={}, Estado={}, Monto={}", txId, reference, status, monto);

            // Guardar o actualizar Pago
            Pago pago = pagoRepository.findByTransaccionIdWompi(txId)
                    .orElse(Pago.builder()
                            .transaccionIdWompi(txId)
                            .referenciaWompi(reference)
                            .build());

            pago.setMonto(monto);
            pago.setMoneda(currency);
            pago.setEstado(status);
            pago.setMetodoPago(paymentMethodType);
            pagoRepository.save(pago);

            // Inferir tipo de plan desde la referencia
            PlanTipo planTipo = PlanTipo.PERSONAL;
            if (reference != null) {
                String refUpper = reference.toUpperCase();
                if (refUpper.contains("ENTERPRISE")) {
                    planTipo = PlanTipo.ENTERPRISE;
                } else if (refUpper.contains("PRO")) {
                    planTipo = PlanTipo.PRO;
                }
            }

            // Resolver el Usuario real desde la BD por UUID en la referencia o por correo
            Usuario usuario = null;
            if (reference != null && reference.startsWith("SUB-")) {
                String[] partes = reference.split("-");
                if (partes.length >= 2) {
                    try {
                        UUID usuarioId = UUID.fromString(partes[1]);
                        usuario = usuarioRepository.findById(usuarioId).orElse(null);
                    } catch (IllegalArgumentException ignored) {
                        // La parte no era UUID
                    }
                }
            }

            if (usuario == null && customerEmail != null && !customerEmail.isBlank()) {
                usuario = usuarioRepository.findByCorreo(customerEmail).orElse(null);
            }

            Venta venta = ventaRepository.findByReferencia(reference)
                    .orElseGet(() -> Venta.builder()
                            .referencia(reference)
                            .build());

            if (usuario != null) {
                String nombreCompleto = ((usuario.getNombre() != null ? usuario.getNombre() : "") + " " +
                        (usuario.getApellido() != null ? usuario.getApellido() : "")).trim();
                if (nombreCompleto.isBlank()) {
                    nombreCompleto = usuario.getUsuario();
                }
                venta.setUsuario(usuario);
                venta.setClienteNombre(nombreCompleto);
                venta.setClienteCorreo(usuario.getCorreo());

                if ("APPROVED".equalsIgnoreCase(status)) {
                    usuario.setPlan(planTipo);
                    usuarioRepository.save(usuario);
                    log.info("Plan actualizado a {} para el usuario {} vía webhook Wompi", planTipo, usuario.getUsuario());
                }
            } else {
                venta.setClienteNombre(customerEmail != null && !customerEmail.isBlank() ? customerEmail : "Cliente Online");
                venta.setClienteCorreo(customerEmail != null && !customerEmail.isBlank() ? customerEmail : "soporte@rompgps.com");
            }

            String periodo = "MENSUAL";
            if (reference != null && reference.toUpperCase().contains("ANUAL")) {
                periodo = "ANUAL";
            }

            venta.setMonto(monto);
            venta.setPlan(planTipo);
            venta.setPeriodo(periodo);
            venta.setMetodoPago(paymentMethodType != null ? paymentMethodType : "WOMPI");
            venta.setEstado("APPROVED".equalsIgnoreCase(status) ? "APROBADO" : "DECLINED".equalsIgnoreCase(status) ? "CANCELADO" : "PENDIENTE");
            venta.setNotas("Webhook Wompi (Tx: " + txId + ")");
            ventaRepository.save(venta);

            if ("APPROVED".equalsIgnoreCase(status)) {
                actualizarSuscripcionPorReferencia(reference);
            }

            return true;
        } catch (Exception e) {
            log.error("Error al procesar webhook de Wompi: {}", e.getMessage(), e);
            return false;
        }
    }

    /** Valida el checksum dinámico enviado por Wompi antes de procesar cualquier evento. */
    @SuppressWarnings("unchecked")
    private boolean validarFirmaEvento(Map<String, Object> payload, String checksumHeader) {
        if (eventsSecret == null || eventsSecret.isBlank()) return false;

        Object firmaObj = payload.get("signature");
        if (!(firmaObj instanceof Map<?, ?> firma)) return false;
        Object propiedadesObj = firma.get("properties");
        if (!(propiedadesObj instanceof List<?> propiedades) || propiedades.isEmpty()) return false;

        String checksumBody = firma.get("checksum") instanceof String valor ? valor : null;
        String checksumRecibido = checksumHeader != null && !checksumHeader.isBlank()
                ? checksumHeader
                : checksumBody;
        if (checksumRecibido == null || !checksumRecibido.matches("(?i)[0-9a-f]{64}")) return false;

        Object dataObj = payload.get("data");
        if (!(dataObj instanceof Map<?, ?> data)) return false;

        StringBuilder cadena = new StringBuilder();
        for (Object propiedadObj : propiedades) {
            if (!(propiedadObj instanceof String propiedad) || propiedad.isBlank()) return false;
            Object valor = resolverPropiedad(data, propiedad);
            if (valor == null) return false;
            cadena.append(valor);
        }

        Object timestamp = payload.get("timestamp");
        if (timestamp == null) return false;
        cadena.append(timestamp).append(eventsSecret);

        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(cadena.toString().getBytes(StandardCharsets.UTF_8));
            byte[] esperado = HexFormat.of().formatHex(hash).getBytes(StandardCharsets.US_ASCII);
            byte[] recibido = checksumRecibido.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII);
            return MessageDigest.isEqual(esperado, recibido);
        } catch (NoSuchAlgorithmException ex) {
            log.error("No fue posible validar la firma del evento Wompi", ex);
            return false;
        }
    }

    private Object resolverPropiedad(Map<?, ?> raiz, String ruta) {
        Object actual = raiz;
        for (String segmento : ruta.split("\\.")) {
            if (!(actual instanceof Map<?, ?> mapa)) return null;
            actual = mapa.get(segmento);
        }
        return actual;
    }

    private void actualizarSuscripcionPorReferencia(String reference) {
        if (reference != null && reference.startsWith("SUB-")) {
            String[] partes = reference.split("-");
            if (partes.length >= 3) {
                String posibleImei = partes[1];
                String plan = partes[2];

                suscripcionRepository.findByImei(posibleImei).ifPresent(suscripcion -> {
                    suscripcion.setPlan(plan);
                    suscripcion.setEstado("ACTIVA");
                    suscripcion.setFechaInicio(LocalDateTime.now());
                    suscripcion.setFechaFin(LocalDateTime.now().plusDays(30));
                    suscripcionRepository.save(suscripcion);
                    log.info("Suscripción ACTIVADA para el vehículo con IMEI {}: Plan {}", posibleImei, plan);
                });
            }
        }
    }
}
