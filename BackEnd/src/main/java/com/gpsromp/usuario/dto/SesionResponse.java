package com.gpsromp.usuario.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.gpsromp.usuario.model.Canal2fa;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Rol;

/**
 * Respuesta de los flujos de autenticación.
 *
 * Incluye soporte para el desafío 2FA cuando el usuario tiene dos factores activado.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SesionResponse(
        String token,
        String refreshToken,
        String usuario,
        Rol rol,
        PlanTipo plan,
        long expiraEnSegundos,
        Boolean perfilCompleto,
        Boolean requiere2FA,
        String ticket2FA,
        Canal2fa canal2FA,
        String destino2FA) {

    public static SesionResponse de(String token, String refreshToken, String usuario,
                                    Rol rol, PlanTipo plan, long expiraEnMs) {
        return new SesionResponse(token, refreshToken, usuario, rol, plan != null ? plan : PlanTipo.PERSONAL,
                expiraEnMs / 1000, null, null, null, null, null);
    }

    public static SesionResponse de(String token, String refreshToken, String usuario,
                                    Rol rol, long expiraEnMs) {
        return de(token, refreshToken, usuario, rol, PlanTipo.PERSONAL, expiraEnMs);
    }

    public static SesionResponse desafio2fa(String usuario, String ticket2FA, Canal2fa canal2FA, String destino2FA) {
        return new SesionResponse(null, null, usuario, null, null, 0, null, true, ticket2FA, canal2FA, destino2FA);
    }

    public SesionResponse conPerfilCompleto(boolean completo) {
        return new SesionResponse(token, refreshToken, usuario, rol, plan, expiraEnSegundos, completo, requiere2FA, ticket2FA, canal2FA, destino2FA);
    }
}
