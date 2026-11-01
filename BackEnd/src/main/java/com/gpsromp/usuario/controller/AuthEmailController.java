package com.gpsromp.usuario.controller;

import com.gpsromp.usuario.dto.SesionResponse;
import com.gpsromp.usuario.dto.SolicitarEmailOtpRequest;
import com.gpsromp.usuario.dto.VerificarEmailOtpRequest;
import com.gpsromp.usuario.service.AuthEmailService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/usuario/email")
@RequiredArgsConstructor
public class AuthEmailController {

    private final AuthEmailService authEmailService;

    @PostMapping("/solicitar-codigo")
    public ResponseEntity<Map<String, Object>> solicitarCodigo(@Valid @RequestBody SolicitarEmailOtpRequest request) {
        return ResponseEntity.ok(authEmailService.solicitarCodigo(request.getIdentificador()));
    }

    @PostMapping("/verificar-codigo")
    public ResponseEntity<SesionResponse> verificarCodigo(@Valid @RequestBody VerificarEmailOtpRequest request) {
        return ResponseEntity.ok(authEmailService.verificarCodigo(request.getIdentificador(), request.getCodigo()));
    }
}
