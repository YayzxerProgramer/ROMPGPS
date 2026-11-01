package com.gpsromp.mantenimiento.prediccion;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

/**
 * Calcula las variables del modelo recorriendo las posiciones GPS UNA SOLA VEZ,
 * en orden cronológico, sin guardarlas en memoria. Es Java puro (sin Spring ni
 * Mongo) para poder probarlo aislado.
 *
 * NO HAY ODÓMETRO: los km salen de sumar la distancia (Haversine) entre
 * posiciones consecutivas, igual que ya hace GPSDataService.
 *
 * DEFINICIONES (son decisiones de diseño; documentadas para poder discutirlas):
 *  - Se ignoran posiciones sin fix válido, con coordenadas (0,0), con tiempo no
 *    creciente, o que implican más de 200 km/h respecto a la anterior (salto GPS).
 *  - "En movimiento" = velocidad > 1 km/h.
 *  - La distancia solo se suma si la posición actual o la anterior está en
 *    movimiento: un vehículo detenido "baila" unos metros y sumaría km falsos.
 *  - Entre dos posiciones separadas por más de 10 min no se suma distancia
 *    (el equipo estuvo apagado o sin señal).
 *  - Parada = detenido 60 s o más. Recorrido = tramo en movimiento; termina
 *    tras una detención de 3 min o más (el mismo criterio de GPSDataService)
 *    o tras un hueco de datos.
 *  - paradas_por_100km y dist_media_recorrido_km se miden sobre todo el ciclo
 *    (desde el último mantenimiento); km_diarios y velocidad, sobre los últimos 30 días.
 *
 * Estas definiciones son nuestras y la distribución real puede no parecerse a la
 * del simulador: por eso las métricas del ml-service con datos simulados no
 * garantizan nada sobre datos reales.
 */
public class AcumuladorCiclo {

    static final double VEL_MOVIMIENTO_KMH = 1.0;
    static final double VEL_MAX_PLAUSIBLE_KMH = 200.0;
    static final long HUECO_MAX_S = 600;
    static final long PARADA_MIN_S = 60;
    static final long FIN_RECORRIDO_S = 180;
    static final double KM_MINIMOS = 5.0;
    static final long DIAS_COBERTURA_TOLERADA = 3;

    private final Instant ahora;
    private final Instant inicioCiclo;
    private final Instant inicio30d;

    private Instant tPrev;
    private double latPrev;
    private double lonPrev;
    private boolean movPrev;
    private Instant primeraMarca;
    private Instant stopInicio;
    private boolean enRecorrido;

    private long puntosValidos;
    private double kmCiclo;
    private double movSegCiclo;
    private double km30;
    private double movSeg30;
    private long paradas;
    private long recorridos;

    public AcumuladorCiclo(LocalDate fechaMantenimiento, Instant ahora, ZoneId zona) {
        this.ahora = ahora;
        this.inicioCiclo = fechaMantenimiento.atStartOfDay(zona).toInstant();
        Instant hace30 = ahora.minus(30, ChronoUnit.DAYS);
        this.inicio30d = hace30.isAfter(inicioCiclo) ? hace30 : inicioCiclo;
    }

    /** Instante desde el que hay que pedir posiciones. */
    public Instant inicioCiclo() {
        return inicioCiclo;
    }

    public long puntosValidos() {
        return puntosValidos;
    }

    /** Las posiciones deben llegar en orden cronológico ascendente. */
    public void agregar(Instant t, double lat, double lon, int velocidad, boolean gpsValido) {
        if (t == null || !gpsValido || t.isBefore(inicioCiclo) || t.isAfter(ahora)) return;
        if ((lat == 0.0 && lon == 0.0) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

        boolean mov = velocidad > VEL_MOVIMIENTO_KMH;

        if (tPrev == null) {
            comenzar(t, lat, lon, mov);
            return;
        }

        long dt = Duration.between(tPrev, t).getSeconds();
        if (dt <= 0) return;

        if (dt > HUECO_MAX_S) {
            cerrarParadaAbierta(tPrev);
            enRecorrido = false;
            comenzar(t, lat, lon, mov);
            return;
        }

        double km = haversineKm(latPrev, lonPrev, lat, lon);
        if (km / dt * 3600.0 > VEL_MAX_PLAUSIBLE_KMH) return;   // salto GPS: se descarta

        puntosValidos++;
        if (mov) {
            if (stopInicio != null) {
                long detenido = Duration.between(stopInicio, t).getSeconds();
                if (detenido >= PARADA_MIN_S) paradas++;
                if (detenido >= FIN_RECORRIDO_S) enRecorrido = false;
                stopInicio = null;
            }
            if (!enRecorrido) {
                recorridos++;
                enRecorrido = true;
            }
        } else if (stopInicio == null) {
            stopInicio = t;
        }

        if (mov || movPrev) {
            kmCiclo += km;
            movSegCiclo += dt;
            if (!t.isBefore(inicio30d)) {
                km30 += km;
                movSeg30 += dt;
            }
        }

        tPrev = t;
        latPrev = lat;
        lonPrev = lon;
        movPrev = mov;
    }

    private void comenzar(Instant t, double lat, double lon, boolean mov) {
        puntosValidos++;
        if (primeraMarca == null) primeraMarca = t;
        tPrev = t;
        latPrev = lat;
        lonPrev = lon;
        movPrev = mov;
        stopInicio = mov ? null : t;
        if (mov && !enRecorrido) {
            recorridos++;
            enRecorrido = true;
        }
    }

    private void cerrarParadaAbierta(Instant hasta) {
        if (stopInicio != null && Duration.between(stopInicio, hasta).getSeconds() >= PARADA_MIN_S) {
            paradas++;
        }
        stopInicio = null;
    }

    /** Resultado final: variables del modelo y, si procede, el motivo por el que no se puede predecir. */
    public Resultado calcular(String tipoVehiculo, String tipoUltimoMant, int numMantPrevios,
                              LocalDate fechaMantenimiento, LocalDate hoy) {
        cerrarParadaAbierta(tPrev != null ? tPrev : ahora);

        if (puntosValidos == 0) {
            return Resultado.sinDatos("No hay posiciones GPS válidas desde el último mantenimiento.");
        }
        if (kmCiclo < KM_MINIMOS || recorridos == 0) {
            return Resultado.sinDatos(String.format(
                    "Aún no hay recorrido suficiente desde el último mantenimiento (%.1f km; se necesitan al menos %.0f).",
                    kmCiclo, KM_MINIMOS));
        }

        double dias = ChronoUnit.DAYS.between(fechaMantenimiento, hoy);
        double horas = movSegCiclo / 3600.0;

        double diasVentana = Math.max(1.0, Math.min(30.0,
                Duration.between(inicio30d, ahora).getSeconds() / 86400.0));
        double kmDiarios = km30 / diasVentana;
        double vel = movSeg30 >= 60 ? km30 / (movSeg30 / 3600.0) : kmCiclo / horas;

        CaracteristicasCiclo c = new CaracteristicasCiclo(
                tipoVehiculo, tipoUltimoMant,
                kmCiclo, dias, horas, numMantPrevios,
                kmDiarios, vel,
                paradas * 100.0 / kmCiclo,
                kmCiclo / recorridos);

        long diasSinCobertura = Duration.between(inicioCiclo, primeraMarca).toDays();
        String aviso = diasSinCobertura > DIAS_COBERTURA_TOLERADA
                ? "El GPS empezó a registrar " + diasSinCobertura
                  + " días después del mantenimiento: los km recorridos pueden estar subestimados."
                : null;

        return new Resultado(c, aviso, null);
    }

    /** Resultado: o bien variables (con aviso opcional de datos incompletos) o bien el motivo de no poder predecir. */
    public record Resultado(CaracteristicasCiclo caracteristicas, String avisoIncompleto, String motivoSinDatos) {
        static Resultado sinDatos(String motivo) {
            return new Resultado(null, null, motivo);
        }

        public boolean hayDatos() {
            return caracteristicas != null;
        }
    }

    static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        final double r = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
