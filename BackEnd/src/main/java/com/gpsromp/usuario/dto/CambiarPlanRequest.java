package com.gpsromp.usuario.dto;

import com.gpsromp.usuario.model.PlanTipo;
import jakarta.validation.constraints.NotNull;

public record CambiarPlanRequest(
        @NotNull(message = "El plan es obligatorio")
        PlanTipo plan
) {
}
