package com.gpsromp.usuario.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.gpsromp.usuario.model.PlanTipo;
import com.gpsromp.usuario.model.Rol;

/**
 * Respuesta de los cuatro flujos de autenticación (login, Google, GitHub y
 * refresco).
 *
 * Los campos "token", "usuario", "rol" y "plan" alimentan el frontend.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SesionResponse(
        String token,
        String refreshToken,
        String usuario,
        Rol rol,
        PlanTipo plan,
        long expiraEnSegundos,
        Boolean perfilCompleto) {

    public static SesionResponse de(String token, String refreshToken, String usuario,
                                    Rol rol, PlanTipo plan, long expiraEnMs) {
        return new SesionResponse(token, refreshToken, usuario, rol, plan != null ? plan : PlanTipo.PERSONAL, expiraEnMs / 1000, null);
    }

    public static SesionResponse de(String token, String refreshToken, String usuario,
                                    Rol rol, long expiraEnMs) {
        return de(token, refreshToken, usuario, rol, PlanTipo.PERSONAL, expiraEnMs);
    }

    public SesionResponse conPerfilCompleto(boolean completo) {
        return new SesionResponse(token, refreshToken, usuario, rol, plan, expiraEnSegundos, completo);
    }
}
