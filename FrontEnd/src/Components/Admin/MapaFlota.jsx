import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { ESTILO_MAPA } from "../mapaUtils";
import { ESTADOS, haceCuanto } from "./adminUtils";
import { post } from "../../Service/api";
import { Confirmar } from "./AdminUI";
import { useAvisar } from "./avisos";

// Mismas opciones de carga que Mapa.jsx: el cargador de Google Maps falla si se
// invoca dos veces con opciones distintas.
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAP_LIBRARIES = ["places"];

const CENTRO_DEFAULT = { lat: 10.419, lng: -75.538 };

const OPCIONES_MAPA = {
  styles: ESTILO_MAPA,
  disableDefaultUI: true,
  gestureHandling: "cooperative",
  clickableIcons: false,
  backgroundColor: "#111411",
};

function htmlMarcador(estado, placa, activo) {
  let punto;
  if (estado === "marcha") {
    punto = `<span class="adm-mk-ping"></span><span class="adm-mk-dot adm-mk-dot--marcha"></span>`;
  } else if (estado === "detenido") {
    punto = `<span class="adm-mk-dot adm-mk-dot--detenido"></span>`;
  } else {
    punto = `<span class="adm-mk-dot adm-mk-dot--sin"></span>`;
  }
  const anillo = activo ? `<span class="adm-mk-anillo"></span>` : "";
  const etiqueta = activo ? `<span class="adm-mk-etiqueta">${placa}</span>` : "";
  return `${anillo}${punto}${etiqueta}`;
}

/**
 * Marcador HTML que recibe clics. El de mapaUtils se dibuja en la capa sin
 * eventos (para no bloquear el arrastre del panel de control); aquí cada
 * unidad es seleccionable, así que va en overlayMouseTarget.
 */
function crearMarcadorFlota(google, mapa, posicion, onClick) {
  class MarcadorFlota extends google.maps.OverlayView {
    constructor() {
      super();
      this.pos = posicion;
      this.tamano = 16;
      this.div = document.createElement("div");
      this.div.className = "adm-mk";
      this.div.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      const proyeccion = this.getProjection();
      if (!proyeccion) return;
      const p = proyeccion.fromLatLngToDivPixel(new google.maps.LatLng(this.pos));
      const s = this.tamano;
      Object.assign(this.div.style, {
        left: `${p.x - s / 2}px`,
        top: `${p.y - s / 2}px`,
        width: `${s}px`,
        height: `${s}px`,
        zIndex: s > 16 ? "10" : "1",
      });
    }

    onRemove() {
      this.div.remove();
    }

    actualizar(pos, html, tamano) {
      this.pos = pos;
      this.tamano = tamano;
      if (this.html !== html) {
        this.div.innerHTML = html;
        this.html = html;
      }
      this.draw();
    }
  }

  const marcador = new MarcadorFlota();
  marcador.setMap(mapa);
  return marcador;
}

export default function MapaFlota({ flota, conteo, seleccion, onElegir, ahora, titulo = "Cartagena · en tiempo real", grande = false, onMotorCambiado }) {
  const avisar = useAvisar();
  const esClaveValida = GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.startsWith("AIzaSy");
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: esClaveValida ? GOOGLE_MAPS_API_KEY : "",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [mapa, setMapa] = useState(null);
  const marcadoresRef = useRef({});
  const encuadradoRef = useRef(false);
  const [dialogoMotor, setDialogoMotor] = useState(null); // null | "corte" | "restablecer"
  const [enviandoComando, setEnviandoComando] = useState(false);

  const [corteManual, setCorteManual] = useState(() => {
    try {
      const guardado = localStorage.getItem("gps_corte_manual");
      return guardado ? JSON.parse(guardado) : {};
    } catch {
      return {};
    }
  });

  const actualizarCorteManual = useCallback((targetImei, nuevoEstado) => {
    setCorteManual((prev) => {
      const nuevo = { ...prev, [targetImei]: nuevoEstado };
      try {
        localStorage.setItem("gps_corte_manual", JSON.stringify(nuevo));
      } catch (err) {
        console.error("Error guardando corte manual en localStorage:", err);
      }
      return nuevo;
    });
  }, []);

  const seleccionado = flota.find((v) => v.id === seleccion) || null;
  const inmovilizado = seleccionado?.imei && corteManual[seleccionado.imei] !== undefined
    ? Boolean(corteManual[seleccionado.imei])
    : Boolean(seleccionado?.pos?.corteMotor || seleccionado?.ultimaPosicion?.corteMotor);

  const encuadrarFlota = useCallback(() => {
    if (!mapa || !window.google) return;
    const puntos = flota.filter((v) => v.pos).map((v) => v.pos);
    if (puntos.length === 0) {
      mapa.setCenter(CENTRO_DEFAULT);
      mapa.setZoom(13);
    } else if (puntos.length === 1) {
      mapa.setCenter(puntos[0]);
      mapa.setZoom(15);
    } else {
      const limites = new window.google.maps.LatLngBounds();
      puntos.forEach((p) => limites.extend(p));
      mapa.fitBounds(limites, 70);
    }
  }, [mapa, flota]);

  // Centra la unidad elegida desde fuera del mapa (tabla, lista, inventario).
  useEffect(() => {
    if (mapa && seleccionado?.pos) {
      mapa.panTo(seleccionado.pos);
      mapa.setZoom(16);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, seleccion]);

  const onElegirRef = useRef(onElegir);
  useEffect(() => {
    onElegirRef.current = onElegir;
  });

  // Sincroniza los marcadores con la flota.
  useEffect(() => {
    if (!mapa || !window.google) return;
    const marcadores = marcadoresRef.current;
    const vigentes = new Set();

    flota.forEach((v) => {
      if (!v.pos) return;
      vigentes.add(v.id);
      const activo = v.id === seleccion;
      if (!marcadores[v.id]) {
        marcadores[v.id] = crearMarcadorFlota(window.google, mapa, v.pos, () => onElegirRef.current(v.id));
      }
      marcadores[v.id].actualizar(v.pos, htmlMarcador(v.estado, v.placa, activo), activo ? 22 : 16);
    });

    Object.keys(marcadores).forEach((id) => {
      if (!vigentes.has(id)) {
        marcadores[id].setMap(null);
        delete marcadores[id];
      }
    });

    // Encuadre automático solo la primera vez que hay posiciones.
    if (!encuadradoRef.current && vigentes.size > 0) {
      encuadradoRef.current = true;
      encuadrarFlota();
    }
  }, [mapa, flota, seleccion, encuadrarFlota]);

  useEffect(() => () => {
    Object.values(marcadoresRef.current).forEach((m) => m.setMap(null));
    marcadoresRef.current = {};
  }, []);

  return (
    <div className={`adm-mapa ${grande ? "adm-mapa--grande" : ""}`}>
      {!esClaveValida || loadError ? (
        <div className="adm-mapa-aviso">
          <span className="material-symbols-outlined">map</span>
          <div>Mapa no disponible</div>
          <small>Configura VITE_GOOGLE_MAPS_API_KEY para ver la flota.</small>
        </div>
      ) : isLoaded ? (
        <GoogleMap
          mapContainerClassName="adm-mapa-lienzo"
          center={CENTRO_DEFAULT}
          zoom={13}
          options={OPCIONES_MAPA}
          onLoad={setMapa}
          onUnmount={() => setMapa(null)}
        />
      ) : (
        <div className="adm-mapa-aviso"><div>Cargando mapa…</div></div>
      )}
      <div className="adm-mapa-degradado" />

      <div className="adm-mapa-cab">
        <div>
          <div className="adm-etiqueta adm-etiqueta--acento">MONITOR DE FLOTA</div>
          <div className="adm-mapa-titulo">{titulo}</div>
        </div>
        <div className="adm-chips">
          <span className="adm-chip"><span className="adm-chip-punto adm-chip-punto--marcha" />En marcha · {conteo.marcha}</span>
          <span className="adm-chip"><span className="adm-chip-punto adm-chip-punto--detenido" />Detenido · {conteo.detenido}</span>
          <span className="adm-chip"><span className="adm-chip-punto adm-chip-punto--sin" />Sin datos · {conteo.sin}</span>
        </div>
      </div>

      {seleccionado && (
        <div className="adm-ficha">
          <div className="adm-ficha-cab">
            <div>
              <div className="adm-ficha-placa">{seleccionado.placa}</div>
              <div className="adm-ficha-sub">{seleccionado.modelo} · {seleccionado.propietario}</div>
            </div>
            <button className="adm-icono-btn adm-icono-btn--sm" aria-label="Cerrar" onClick={() => onElegir(null)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="adm-ficha-datos">
            <div>
              <div className="adm-etiqueta">VELOCIDAD</div>
              <div className="adm-ficha-vel">{seleccionado.pos?.vel ?? 0}<small> km/h</small></div>
            </div>
            <div>
              <div className="adm-etiqueta">ESTADO</div>
              <div className={`adm-ficha-estado adm-tono--${seleccionado.estado}`}>{ESTADOS[seleccionado.estado]}</div>
            </div>
          </div>
          <div className="adm-ficha-coords">
            <span>{seleccionado.pos ? `${seleccionado.pos.lat.toFixed(5)}, ${seleccionado.pos.lng.toFixed(5)}` : "—"}</span>
            <span>{seleccionado.pos ? haceCuanto(seleccionado.pos.fecha, ahora) : "sin reportes"}</span>
          </div>

          {seleccionado.imei ? (
            <div className="adm-ficha-motor">
              <div className="adm-ficha-motor-cab">
                <span className="adm-etiqueta">ESTADO MOTOR</span>
                <span className={`adm-ficha-motor-tag ${inmovilizado ? "adm-ficha-motor-tag--cortado" : "adm-ficha-motor-tag--activo"}`}>
                  <span className={`adm-chip-punto ${inmovilizado ? "adm-chip-punto--detenido" : "adm-chip-punto--marcha"}`} />
                  {inmovilizado ? "INMOVILIZADO" : seleccionado.pos?.acc ? "IGNICIÓN ON" : "OPERATIVO"}
                </span>
              </div>
              <button
                type="button"
                className={`adm-btn-motor ${inmovilizado ? "adm-btn-motor--restablecer" : "adm-btn-motor--apagar"}`}
                onClick={() => setDialogoMotor(inmovilizado ? "restablecer" : "corte")}
                disabled={enviandoComando}
                title={inmovilizado ? "Rehabilitar encendido del motor" : "Enviar orden de corte de motor"}
              >
                <span className="material-symbols-outlined">
                  {inmovilizado ? "restart_alt" : "power_settings_new"}
                </span>
                {inmovilizado ? "Restablecer motor" : "Apagar motor"}
              </button>
            </div>
          ) : (
            <div className="adm-ficha-sin-gps">
              <span className="material-symbols-outlined">satellite_alt</span>
              <span>Sin GPS asignado · Comandos inactivos</span>
            </div>
          )}

          {seleccionado.pos && (
            <a
              className="adm-enlace"
              href={`https://www.google.com/maps?q=${seleccionado.pos.lat},${seleccionado.pos.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="material-symbols-outlined">location_on</span>VER EN GOOGLE MAPS
            </a>
          )}
        </div>
      )}

      {dialogoMotor && seleccionado && (
        <Confirmar
          titulo={dialogoMotor === "corte" ? `¿Apagar motor de ${seleccionado.placa}?` : `¿Restablecer motor de ${seleccionado.placa}?`}
          peligro={dialogoMotor === "corte"}
          icono={dialogoMotor === "corte" ? "power_settings_new" : "restart_alt"}
          textoConfirmar={dialogoMotor === "corte" ? "Apagar motor" : "Restablecer motor"}
          mensaje={
            dialogoMotor === "corte"
              ? `¿Confirmas enviar la orden de apagado de motor para ${seleccionado.placa} (${seleccionado.modelo})? Se enviará un comando SMS (RELAY,1#) al GPS GT06 para inmovilizar la unidad de inmediato.`
              : `Se enviará la orden SMS (RELAY,0#) al GPS GT06 para rehabilitar el encendido del motor de ${seleccionado.placa}.`
          }
          onConfirmar={async () => {
            setEnviandoComando(true);
            const accion = dialogoMotor;
            try {
              await post("/gps/comando-sms", {
                imei: seleccionado.imei,
                comando: accion === "corte" ? "CORTE_MOTOR" : "RESTAURAR_MOTOR",
              });
              const nuevoCorte = accion === "corte";
              actualizarCorteManual(seleccionado.imei, nuevoCorte);
              if (onMotorCambiado) {
                onMotorCambiado(seleccionado.imei, nuevoCorte);
              }
              avisar(
                nuevoCorte
                  ? `Comando enviado: Motor de ${seleccionado.placa} apagado.`
                  : `Comando enviado: Motor de ${seleccionado.placa} restablecido.`
              );
              setDialogoMotor(null);
            } catch (err) {
              avisar(err.message || "Error al enviar el comando SMS al vehículo", "error");
            } finally {
              setEnviandoComando(false);
            }
          }}
          onCerrar={() => setDialogoMotor(null)}
        />
      )}

      <div className="adm-zoom">
        <button title="Acercar" onClick={() => mapa && mapa.setZoom(mapa.getZoom() + 1)}>
          <span className="material-symbols-outlined">add</span>
        </button>
        <button title="Alejar" onClick={() => mapa && mapa.setZoom(mapa.getZoom() - 1)}>
          <span className="material-symbols-outlined">remove</span>
        </button>
        <button title="Ver toda la flota" className="acento" onClick={encuadrarFlota}>
          <span className="material-symbols-outlined">fit_screen</span>
        </button>
      </div>
    </div>
  );
}
