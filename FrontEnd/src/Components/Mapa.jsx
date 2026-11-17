import { GoogleMap, useJsApiLoader, Polyline } from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
import { distancia } from "./mapaUtils";
import "../Styles/MapaGPS.css";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const ANIMATION_DURATION = 1000;
const GOOGLE_MAP_LIBRARIES = ["places"];

const centroDefault = { lat: 10.425, lng: -75.5402 };

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#121412" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#121412" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ea89e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#dce4dc" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6e8a66" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1e1a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#383e38" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a5235" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#86A17D" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d100d" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#161916" }] },
];

function MapaGPS({ position, connected, siguiendo = true, atenuado = false, onArrastre, onMapLoad }) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [path, setPath] = useState([]);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const startPosRef = useRef(null);
  const targetPosRef = useRef(null);
  const startTimeRef = useRef(null);

  // Control para cambio de unidad o reseteo de saltos espurios
  const ultimoImeiRef = useRef(null);
  const saltoSospechosoRef = useRef(null);

  // Reiniciar trazado cuando se cambia de vehículo para no cruzar líneas entre unidades
  useEffect(() => {
    if (position?.imei && ultimoImeiRef.current && ultimoImeiRef.current !== position.imei) {
      setPath([]);
      startPosRef.current = null;
      saltoSospechosoRef.current = null;
    }
    if (position?.imei) {
      ultimoImeiRef.current = position.imei;
    }
  }, [position?.imei]);

  // Cuando llega una nueva posición, se filtra y actualiza suavemente
  useEffect(() => {
    if (!position || !markerRef.current) return;

    // 1. Descartar tramas sin fix satelital válido reportadas por el módulo
    if (position.gpsValido === false) {
      return;
    }

    const lat = Number(position.latitud);
    const lng = Number(position.longitud);

    // 2. Descartar coordenadas inválidas, nulas o con hemisferio corrupto
    if (isNaN(lat) || isNaN(lng) || lat <= 0 || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
      return;
    }

    const newTarget = { lat, lng };

    // 3. Filtro Anti-Rebote / Glitch LBS:
    // Evita que rebotes a antenas celulares (LBS) o fallos de multipath tracen
    // líneas de ida y vuelta a kilómetros de distancia mientras se circula.
    const currentPos = markerRef.current.getPosition();
    const posActual = currentPos
      ? {
          lat: typeof currentPos.lat === "function" ? currentPos.lat() : currentPos.lat,
          lng: typeof currentPos.lng === "function" ? currentPos.lng() : currentPos.lng,
        }
      : null;

    if (posActual && Math.abs(posActual.lat) > 0.001) {
      const d = distancia(posActual, newTarget);
      const vel = Number(position.velocidad) || 0;

      // Salto instantáneo mayor a 450 metros a velocidad normal urbana
      if (d > 450 && vel < 160) {
        // Si es la primera vez que se detecta este punto lejano, se retiene como sospechoso
        if (!saltoSospechosoRef.current || distancia(saltoSospechosoRef.current, newTarget) > 100) {
          saltoSospechosoRef.current = newTarget;
          console.warn(`[GPS Filter] Rebote descartado: salto de ${Math.round(d)}m`);
          return;
        }

        // Si se confirma en dos reportes seguidos, el vehículo realmente se movió allí (p. ej. transporte en grúa)
        saltoSospechosoRef.current = null;
        setPath([newTarget]); // Reiniciar la línea para no trazar la recta gigante
      } else {
        saltoSospechosoRef.current = null;
      }
    }

    setPath((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (Math.abs(last.lat - newTarget.lat) < 0.00001 && Math.abs(last.lng - newTarget.lng) < 0.00001) {
          return prev;
        }
      }
      return [...prev.slice(-100), newTarget];
    });

    if (mapRef.current && siguiendo) {
      mapRef.current.panTo(newTarget);
    }

    startPosRef.current = posActual || newTarget;
    targetPosRef.current = newTarget;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    startTimeRef.current = performance.now();

    function animate(now) {
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / ANIMATION_DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);

      const interpolated = {
        lat: lerp(startPosRef.current.lat, targetPosRef.current.lat, eased),
        lng: lerp(startPosRef.current.lng, targetPosRef.current.lng, eased),
      };

      if (markerRef.current) {
        markerRef.current.setPosition(interpolated);
      }

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [position, siguiendo]);

  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    };
  }, []);

  const handleMapLoad = (map) => {
    mapRef.current = map;

    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    const posInicial = (position && position.latitud && position.longitud)
      ? { lat: Number(position.latitud), lng: Number(position.longitud) }
      : centroDefault;

    // Marcador con animación intermitente (aparece y desaparece como baliza GPS)
    class MarcadorIntermitenteGPS extends window.google.maps.OverlayView {
      constructor(pos, atenuadoInicial, tituloInicial) {
        super();
        this.pos = pos;
        this.div = document.createElement("div");
        this.div.className = "marcador-gps-contenedor";
        if (atenuadoInicial) this.div.style.opacity = "0.35";
        this.div.title = tituloInicial || "Vehículo en vivo";
        this.div.innerHTML = `
          <div class="marcador-gps-intermitente">
            <div class="marcador-halo-intermitente"></div>
            <div class="marcador-nucleo">
              <div class="marcador-anillo-blanco">
                <div class="marcador-centro-verde">
                  <div class="marcador-punto-luz"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      onAdd() {
        const panes = this.getPanes();
        if (panes && panes.overlayLayer) {
          panes.overlayLayer.appendChild(this.div);
        }
      }

      draw() {
        const proyeccion = this.getProjection();
        if (!proyeccion || !this.pos) {
          if (this.div) this.div.style.display = "none";
          return;
        }

        const latLng = typeof this.pos.lat === "function"
          ? this.pos
          : new window.google.maps.LatLng(this.pos.lat, this.pos.lng);

        const pixel = proyeccion.fromLatLngToDivPixel(latLng);
        if (!pixel) return;

        this.div.style.display = "";
        const mitad = 24; // 48px / 2
        this.div.style.left = `${pixel.x - mitad}px`;
        this.div.style.top = `${pixel.y - mitad}px`;
      }

      onRemove() {
        if (this.div && this.div.parentNode) {
          this.div.parentNode.removeChild(this.div);
        }
      }

      setPosition(pos) {
        this.pos = pos;
        this.draw();
      }

      getPosition() {
        if (!this.pos) return null;
        return {
          lat: () => (typeof this.pos.lat === "function" ? this.pos.lat() : this.pos.lat),
          lng: () => (typeof this.pos.lng === "function" ? this.pos.lng() : this.pos.lng),
        };
      }

      setOpacity(valor) {
        if (this.div) {
          this.div.style.opacity = String(valor);
        }
      }

      setTitle(texto) {
        if (this.div) {
          this.div.title = texto || "";
        }
      }
    }

    const marker = new MarcadorIntermitenteGPS(
      posInicial,
      atenuado,
      connected ? "Vehículo en vivo" : "Última posición vista"
    );
    marker.setMap(map);

    markerRef.current = marker;

    if (position && position.latitud && position.longitud) {
      map.panTo(posInicial);
      map.setZoom(17);
    }

    if (onMapLoad) {
      onMapLoad(map, window.google);
    }
  };

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setOpacity(atenuado ? 0.35 : 1);
    }
  }, [atenuado]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setTitle(
        connected
          ? "Vehículo en vivo"
          : `Última posición vista (${position?.registradoEn ? new Date(position.registradoEn).toLocaleString("es-CO") : "Desconectado"})`
      );
    }
  }, [connected, position]);

  if (!isLoaded) return <div className="loading-screen">Cargando mapa...</div>;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100vh" }}
        mapContainerClassName="map-container"
        center={centroDefault}
        zoom={15}
        onLoad={handleMapLoad}
        onDragStart={onArrastre}
        options={{
          styles: darkMapStyle,
          disableDefaultUI: true,
          // El zoom lo manejan los botones propios del panel (.pc-zoom)
          zoomControl: false,
          streetViewControl: false, 
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          clickableIcons: false,
        }}
      >
        {path.length > 1 && (
          <Polyline
            path={path}
            options={{
              strokeColor: "#22c55e",
              strokeOpacity: 1,
              strokeWeight: 4,
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}

export default MapaGPS;
