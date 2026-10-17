package com.gpsromp.usuario.model;

import java.math.BigDecimal;

/**
 * Planes disponibles en la plataforma (alineados con la landing page).
 *
 * PERSONAL:   Plan básico para moto/auto particular ($24.900 COP / mes)
 * PRO:        Flotas & Negocios Pro con rutas Google Maps ($44.900 COP / mes)
 * ENTERPRISE: Corporativo con API, soporte prioritario y navegación completa ($79.900 COP / mes)
 */
public enum PlanTipo {

    PERSONAL("Personal (Moto / Auto)", BigDecimal.valueOf(24900), false),
    PRO("Flotas & Negocios Pro", BigDecimal.valueOf(44900), true),
    ENTERPRISE("Empresarial Custom", BigDecimal.valueOf(79900), true);

    private final String nombre;
    private final BigDecimal precioMensual;
    private final boolean incluyeNavegacion;

    PlanTipo(String nombre, BigDecimal precioMensual, boolean incluyeNavegacion) {
        this.nombre = nombre;
        this.precioMensual = precioMensual;
        this.incluyeNavegacion = incluyeNavegacion;
    }

    public String getNombre() {
        return nombre;
    }

    public BigDecimal getPrecioMensual() {
        return precioMensual;
    }

    public boolean isIncluyeNavegacion() {
        return incluyeNavegacion;
    }
}
