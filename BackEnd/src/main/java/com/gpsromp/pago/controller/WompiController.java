package com.gpsromp.pago.controller;

import com.gpsromp.pago.dto.ConfirmarCompraRequest;
import com.gpsromp.pago.service.WompiService;
import com.gpsromp.venta.dto.VentaResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/pagos")
@RequiredArgsConstructor
@Slf4j
public class WompiController {

    private final WompiService wompiService;

    @PostMapping("/wompi/webhook")
    public ResponseEntity<Map<String, Object>> webhook(@RequestBody Map<String, Object> payload) {
        log.info("Webhook Wompi invocado");
        boolean procesado = wompiService.procesarWebhook(payload);
        return ResponseEntity.ok(Map.of("recibido", procesado));
    }

    @PostMapping("/confirmar-compra")
    public ResponseEntity<VentaResponse> confirmarCompra(
            Authentication authentication,
            @Valid @RequestBody ConfirmarCompraRequest req) {
        String nombreUsuario = authentication != null ? authentication.getName() : null;
        log.info("Confirmación directa de compra recibida para {}: Plan={}, Ref={}", nombreUsuario, req.plan(), req.referencia());
        return ResponseEntity.ok(wompiService.confirmarCompra(nombreUsuario, req));
    }
}
