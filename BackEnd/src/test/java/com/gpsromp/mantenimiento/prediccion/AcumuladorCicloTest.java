package com.gpsromp.mantenimiento.prediccion;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class AcumuladorCicloTest {

    private static final ZoneId ZONA = ZoneId.of("America/Bogota");
    private static final LocalDate FECHA_MANT = LocalDate.of(2026, 9, 1);
    private static final LocalDate HOY = LocalDate.of(2026, 10, 1);
    private static final Instant AHORA = HOY.atStartOfDay(ZONA).toInstant();
    private static final Instant T0 = FECHA_MANT.atStartOfDay(ZONA).toInstant().plusSeconds(3600);

    /** ~0.0009 grados de latitud = ~100 m. */
    private static final double PASO = 0.0009;

    private AcumuladorCiclo nuevo() {
        return new AcumuladorCiclo(FECHA_MANT, AHORA, ZONA);
    }

    /** Un recorrido recto hacia el norte: `pasos` puntos cada 10 s a ~36 km/h. */
    private double recorrido(AcumuladorCiclo a, Instant desde, double latInicial, int pasos) {
        double lat = latInicial;
        for (int i = 0; i < pasos; i++) {
            a.agregar(desde.plusSeconds(10L * i), lat, -74.0, 36, true);
            lat += PASO;
        }
        return lat;
    }

    @Test
    void sinPosicionesNoHayDatos() {
        var r = nuevo().calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertFalse(r.hayDatos());
        assertNotNull(r.motivoSinDatos());
    }

    @Test
    void sumaKilometrosPorHaversine() {
        var a = nuevo();
        recorrido(a, T0, 4.0, 501);           // 500 tramos de ~100 m = ~50 km
        var r = a.calcular("MOTO", "PREVENTIVO", 2, FECHA_MANT, HOY);
        assertTrue(r.hayDatos());
        assertEquals(50.0, r.caracteristicas().kmDesdeUltMant(), 1.0);
        assertEquals(30.0, r.caracteristicas().diasDesdeUltMant(), 0.0);
        assertEquals(1.0, r.caracteristicas().distMediaRecorridoKm() / 50.0, 0.05);   // un solo recorrido
        assertEquals(36.0, r.caracteristicas().velPromMov30d(), 1.5);
    }

    @Test
    void elVehiculoDetenidoNoSumaKilometros() {
        var a = nuevo();
        double lat = recorrido(a, T0, 4.0, 200);                // ~20 km
        Instant t = T0.plusSeconds(2000);
        for (int i = 0; i < 100; i++) {                         // detenido con "baile" de GPS
            a.agregar(t.plusSeconds(10L * i), lat + (i % 2) * 0.0001, -74.0, 0, true);
        }
        var r = a.calcular("CARRO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertEquals(20.0, r.caracteristicas().kmDesdeUltMant(), 1.0);
    }

    @Test
    void cuentaParadasYRecorridos() {
        var a = nuevo();
        Instant t = T0;
        double lat = 4.0;
        for (int tramo = 0; tramo < 3; tramo++) {
            lat = recorrido(a, t, lat, 100);                    // ~10 km
            t = t.plusSeconds(1000);
            // detenido 4 min (>= 3 min: termina el recorrido y cuenta como parada)
            for (int i = 0; i < 25; i++) {
                a.agregar(t.plusSeconds(10L * i), lat, -74.0, 0, true);
            }
            t = t.plusSeconds(250);
        }
        recorrido(a, t, lat, 100);                              // 4.º recorrido, ~10 km
        var c = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY).caracteristicas();
        // 3 paradas en ~40 km
        assertEquals(3 * 100.0 / c.kmDesdeUltMant(), c.paradasPor100km(), 0.01);
        assertEquals(c.kmDesdeUltMant() / 4.0, c.distMediaRecorridoKm(), 0.01);
    }

    @Test
    void descartaSaltosDeGps() {
        var a = nuevo();
        double lat = recorrido(a, T0, 4.0, 100);                // ~10 km
        a.agregar(T0.plusSeconds(1010), 40.0, -3.0, 36, true);   // salto a otro continente en 10 s
        recorrido(a, T0.plusSeconds(1020), lat, 100);           // sigue por donde iba
        var r = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertTrue(r.caracteristicas().kmDesdeUltMant() < 25.0);
    }

    @Test
    void ignoraPosicionesSinFixYCoordenadasCero() {
        var a = nuevo();
        a.agregar(T0, 4.0, -74.0, 30, false);
        a.agregar(T0.plusSeconds(10), 0.0, 0.0, 30, true);
        var r = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertFalse(r.hayDatos());
        assertEquals(0, a.puntosValidos());
    }

    @Test
    void pocosKilometrosNoSePredicen() {
        var a = nuevo();
        recorrido(a, T0, 4.0, 11);                              // ~1 km
        var r = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertFalse(r.hayDatos());
        assertTrue(r.motivoSinDatos().contains("recorrido suficiente"));
    }

    @Test
    void avisaSiElGpsEmpezoTarde() {
        var a = nuevo();
        recorrido(a, T0.plusSeconds(10L * 86400), 4.0, 200);    // 10 días después del mantenimiento
        var r = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertTrue(r.hayDatos());
        assertNotNull(r.avisoIncompleto());
    }

    @Test
    void sinAvisoSiElGpsEstabaDesdeElPrincipio() {
        var a = nuevo();
        recorrido(a, T0, 4.0, 200);
        assertNull(a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY).avisoIncompleto());
    }

    @Test
    void unHuecoDeDatosNoSumaDistancia() {
        var a = nuevo();
        a.agregar(T0, 4.0, -74.0, 36, true);
        a.agregar(T0.plusSeconds(3600), 4.5, -74.0, 36, true);   // 1 h sin datos y ~55 km "de golpe"
        recorrido(a, T0.plusSeconds(3610), 4.5, 100);            // ~10 km
        var r = a.calcular("MOTO", "PREVENTIVO", 1, FECHA_MANT, HOY);
        assertEquals(10.0, r.caracteristicas().kmDesdeUltMant(), 1.0);
    }
}
