import { GoogleMap, useJsApiLoader, Polyline } from "@react-google-maps/api";
import { useState, useRef, useEffect } from "react";
import markerCircle from "../assets/marker-circle.svg";
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

  // Cuando llega una nueva posición, se actualiza suavemente sin lag
  
  useEffect(() => {
    if (!position || !markerRef.current) return;

    const newTarget = {
      lat: Number(position.latitud),
      lng: Number(position.longitud),
    };

    if (isNaN(newTarget.lat) || isNaN(newTarget.lng)) return;

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

    const currentPos = markerRef.current.getPosition();
    startPosRef.current = currentPos
      ? { lat: currentPos.lat(), lng: currentPos.lng() }
      : newTarget;
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

    const marker = new window.google.maps.Marker({
      map,
      position: posInicial,
      opacity: atenuado ? 0.35 : 1,
      icon: {
        url: markerCircle,
        scaledSize: new window.google.maps.Size(48, 48),
        anchor: new window.google.maps.Point(24, 24),
      },
    });

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
          zoomControl: true,
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
