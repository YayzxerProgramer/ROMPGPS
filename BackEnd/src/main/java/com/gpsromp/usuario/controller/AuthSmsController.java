package com.gpsromp.usuario.controller;

import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.dto.SolicitarSmsRequest;
import com.gpsromp.usuario.dto.VerificarSmsRequest;
import com.gpsromp.usuario.service.AuthSmsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/usuario/sms")
@RequiredArgsConstructor
public class AuthSmsController {

    private final AuthSmsService authSmsService;

    @PostMapping("/solicitar-codigo")
    public ResponseEntity<Map<String, Object>> solicitarCodigo(@Valid @RequestBody SolicitarSmsRequest request) {
        if (request.getIdentificador() != null && !request.getIdentificador().isBlank()) {
            return ResponseEntity.ok(authSmsService.solicitarCodigoIdentificador(request.getIdentificador()));
        }
        boolean enviado = authSmsService.solicitarCodigo(request.getTelefono());
        return ResponseEntity.ok(Map.of(
                "exito", enviado,
                "mensaje", enviado ? "Código OTP enviado por SMS" : "No se pudo enviar el SMS",
                "destino", request.getTelefono() != null ? request.getTelefono() : ""
        ));
    }

    @PostMapping("/verificar-codigo")
    public ResponseEntity<SesionResponse> verificarCodigo(@Valid @RequestBody VerificarSmsRequest request) {
        if (request.getIdentificador() != null && !request.getIdentificador().isBlank()) {
            return ResponseEntity.ok(authSmsService.verificarCodigoIdentificador(request.getIdentificador(), request.getCodigo()));
        }
        SesionResponse sesion = authSmsService.verificarCodigo(request.getTelefono(), request.getCodigo());
        return ResponseEntity.ok(sesion);
    }
}
