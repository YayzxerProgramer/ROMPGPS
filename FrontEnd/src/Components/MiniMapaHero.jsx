import { useEffect, useRef } from "react";
import "../Styles/MiniMapaHero.css";

// Waypoints de la ruta en coordenadas del mundo (2400 x 1600)
// Recorre avenida costera, viaducto sobre el agua, glorieta, distrito urbano, parque y retorno.
const WAYPOINTS = [
  { x: 550, y: 250, speed: 58, lat: 10.4285, lng: -75.5512 },
  { x: 570, y: 480, speed: 64, lat: 10.4262, lng: -75.5505 },
  { x: 530, y: 720, speed: 52, lat: 10.4238, lng: -75.5518 },
  { x: 420, y: 780, speed: 38, lat: 10.4230, lng: -75.5545 }, // Entrada al viaducto
  { x: 280, y: 830, speed: 35, lat: 10.4222, lng: -75.5580 }, // Sobre la bahía
  { x: 250, y: 920, speed: 36, lat: 10.4208, lng: -75.5588 }, // Isla / puerto marítimo
  { x: 370, y: 990, speed: 42, lat: 10.4198, lng: -75.5558 }, // Retorno del viaducto
  { x: 580, y: 1060, speed: 55, lat: 10.4188, lng: -75.5502 }, // Autopista costera sur
  { x: 820, y: 1100, speed: 60, lat: 10.4182, lng: -75.5442 }, // Av. Transversal
  { x: 1150, y: 1100, speed: 56, lat: 10.4182, lng: -75.5360 }, // Aproximación glorieta
  { x: 1260, y: 1020, speed: 32, lat: 10.4195, lng: -75.5332 }, // Entrada a glorieta
  { x: 1330, y: 950, speed: 30, lat: 10.4208, lng: -75.5315 }, // Giro en glorieta
  { x: 1280, y: 860, speed: 34, lat: 10.4222, lng: -75.5328 }, // Salida norte de glorieta
  { x: 1300, y: 650, speed: 58, lat: 10.4250, lng: -75.5322 }, // Corredor Parque Central
  { x: 1300, y: 420, speed: 54, lat: 10.4278, lng: -75.5322 }, // Cruce norte
  { x: 1420, y: 350, speed: 48, lat: 10.4288, lng: -75.5292 }, // Giro hacia Diagonal
  { x: 1720, y: 350, speed: 66, lat: 10.4288, lng: -75.5218 }, // Recta fluida
  { x: 1940, y: 440, speed: 52, lat: 10.4275, lng: -75.5162 }, // Curva financiera
  { x: 1950, y: 780, speed: 62, lat: 10.4230, lng: -75.5160 }, // Av. Oriental sur
  { x: 1860, y: 1220, speed: 58, lat: 10.4168, lng: -75.5182 }, // Zona logística
  { x: 1520, y: 1340, speed: 64, lat: 10.4150, lng: -75.5268 }, // Corredor de carga
  { x: 1050, y: 1340, speed: 62, lat: 10.4150, lng: -75.5385 }, // Corredor oeste
  { x: 740, y: 1250, speed: 55, lat: 10.4162, lng: -75.5462 }, // Enlace costero
  { x: 620, y: 960, speed: 56, lat: 10.4205, lng: -75.5492 }, // Retorno norte
  { x: 540, y: 620, speed: 65, lat: 10.4248, lng: -75.5515 }, // Recta Malecón
  { x: 530, y: 350, speed: 67, lat: 10.4272, lng: -75.5518 }  // Cierre de circuito
];

// Generación de spline Catmull-Rom para curvaturas continuas
function generateSmoothRoute(waypoints, pointsPerSegment = 50) {
  const n = waypoints.length;
  const path = [];

  for (let i = 0; i < n; i++) {
    const p0 = waypoints[(i - 1 + n) % n];
    const p1 = waypoints[i];
    const p2 = waypoints[(i + 1) % n];
    const p3 = waypoints[(i + 2) % n];

    for (let step = 0; step < pointsPerSegment; step++) {
      const t = step / pointsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

      const speed = p1.speed + (p2.speed - p1.speed) * t;
      const lat = p1.lat + (p2.lat - p1.lat) * t;
      const lng = p1.lng + (p2.lng - p1.lng) * t;

      path.push({ x, y, speed, lat, lng });
    }
  }

  // Precalcular orientación (heading) en radianes
  const total = path.length;
  for (let i = 0; i < total; i++) {
    const next = path[(i + 1) % total];
    path[i].heading = Math.atan2(next.y - path[i].y, next.x - path[i].x);
  }

  return path;
}

// Generador de bloques urbanos estáticos
function createCityBlocks() {
  const blocks = [];

  // Bloques del Distrito Financiero y Comercial (Este)
  for (let x = 1450; x < 2100; x += 180) {
    for (let y = 450; y < 1200; y += 140) {
      blocks.push({
        x: x + 15,
        y: y + 15,
        w: 150,
        h: 110,
        type: "commercial"
      });
    }
  }

  // Bloques Residenciales / Urbanos (Centro)
  for (let x = 750; x < 1200; x += 140) {
    for (let y = 200; y < 850; y += 130) {
      blocks.push({
        x: x + 12,
        y: y + 12,
        w: 115,
        h: 105,
        type: "residential"
      });
    }
  }

  // Bloques de la Zona Logística e Industrial (Sur)
  for (let x = 900; x < 1800; x += 220) {
    for (let y = 1200; y < 1500; y += 140) {
      blocks.push({
        x: x + 15,
        y: y + 15,
        w: 190,
        h: 110,
        type: "industrial"
      });
    }
  }

  return blocks;
}

const CITY_BLOCKS = createCityBlocks();
const ROUTE_POINTS = generateSmoothRoute(WAYPOINTS, 45);

const HUD_DATA = {
  satelites: 14,
  hdop: "0.8",
  modo: "RTK FIX"
};

export default function MiniMapaHero({ onTelemetryUpdate }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    // Observador de visibilidad (pausar si la sección no está en pantalla)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisibleRef.current = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Ajustar dimensiones con DPI para nitidez retina
    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      const rect = containerRef.current.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Variables de simulación del vehículo y cámara
    let routeIndex = 0;
    const totalPoints = ROUTE_POINTS.length;

    // Cámara con suavizado lerp
    let camX = ROUTE_POINTS[0].x;
    let camY = ROUTE_POINTS[0].y;

    // Animación de pulsos de radar
    let pulseProgress = 0;
    let lastTelemetryEmit = 0;
    let lastTimestamp = 0;

    const render = (timestamp) => {
      if (!isVisibleRef.current) {
        lastTimestamp = timestamp;
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaSec = Math.min((timestamp - lastTimestamp) / 1000, 0.06);
      lastTimestamp = timestamp;

      // Avanzar vehículo a velocidad calmada y suave (~24 puntos por segundo)
      routeIndex = (routeIndex + deltaSec * 24) % totalPoints;
      const curIdx = Math.floor(routeIndex);
      const currentPoint = ROUTE_POINTS[curIdx];

      // Cámara suave: el objetivo sigue al vehículo con amortiguación fluida
      const targetCamX = currentPoint.x;
      const targetCamY = currentPoint.y;
      camX += (targetCamX - camX) * 0.05;
      camY += (targetCamY - camY) * 0.05;

      // Pulso suave de radar
      pulseProgress = (pulseProgress + 0.012) % 1;

      // Notificar telemetría hacia Hero.jsx (limitado a ~120ms para rendimiento óptimo)
      if (onTelemetryUpdate && timestamp - lastTelemetryEmit > 120) {
        lastTelemetryEmit = timestamp;
        // Fluctuación realista de señal
        const senalActual = 99.6 + Math.sin(timestamp * 0.002) * 0.3;
        onTelemetryUpdate({
          velocidad: currentPoint.speed,
          lat: `${currentPoint.lat.toFixed(4)}° N`,
          lng: `${Math.abs(currentPoint.lng).toFixed(4)}° O`,
          senal: senalActual,
          alt: "2.4m"
        });
      }

      // ==========================================
      // DIBUJADO EN CANVAS
      // ==========================================
      ctx.save();
      ctx.scale(dpr, dpr);

      // Fondo base de terreno
      ctx.fillStyle = "#111512";
      ctx.fillRect(0, 0, width, height);

      // Transformación de la cámara (centrada en el viewport)
      ctx.save();
      ctx.translate(width / 2, height / 2);
      // Zoom óptimo para ver el contexto urbano y la velocidad de desplazamiento
      const zoom = 0.88;
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // 1. Cuadrícula táctica tenue de fondo
      ctx.strokeStyle = "rgba(178, 206, 168, 0.04)";
      ctx.lineWidth = 1;
      const gridSize = 120;
      const startGridX = Math.floor((camX - 600) / gridSize) * gridSize;
      const endGridX = startGridX + 1200;
      const startGridY = Math.floor((camY - 500) / gridSize) * gridSize;
      const endGridY = startGridY + 1000;

      ctx.beginPath();
      for (let gx = startGridX; gx <= endGridX; gx += gridSize) {
        ctx.moveTo(gx, startGridY);
        ctx.lineTo(gx, endGridY);
      }
      for (let gy = startGridY; gy <= endGridY; gy += gridSize) {
        ctx.moveTo(startGridX, gy);
        ctx.lineTo(endGridX, gy);
      }
      ctx.stroke();

      // Marcadores tácticos de cruce (+)
      ctx.fillStyle = "rgba(178, 206, 168, 0.12)";
      ctx.font = "10px monospace";
      for (let gx = startGridX; gx <= endGridX; gx += gridSize * 2) {
        for (let gy = startGridY; gy <= endGridY; gy += gridSize * 2) {
          ctx.fillText("+", gx - 3, gy + 3);
        }
      }

      // 2. Bahía / Masa de Agua (Costa de Cartagena)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(480, 0);
      ctx.bezierCurveTo(420, 250, 520, 450, 450, 700);
      ctx.bezierCurveTo(550, 950, 650, 1200, 700, 1600);
      ctx.lineTo(0, 1600);
      ctx.closePath();
      ctx.fillStyle = "#0a110e";
      ctx.fill();

      // Línea de oleaje / orilla luminosa
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(178, 206, 168, 0.22)";
      ctx.stroke();

      // Isla en la bahía
      ctx.beginPath();
      ctx.ellipse(250, 880, 70, 45, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#101612";
      ctx.fill();
      ctx.strokeStyle = "rgba(178, 206, 168, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Muelles / embarcaderos
      ctx.strokeStyle = "#273626";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(460, 680);
      ctx.lineTo(380, 680);
      ctx.moveTo(480, 740);
      ctx.lineTo(390, 740);
      ctx.moveTo(520, 860);
      ctx.lineTo(420, 860);
      ctx.stroke();

      // 3. Zonas Verdes / Parques Urbanos
      // Parque Central
      ctx.beginPath();
      ctx.roundRect(1320, 470, 320, 240, 14);
      ctx.fillStyle = "#122014";
      ctx.fill();
      ctx.strokeStyle = "rgba(178, 206, 168, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Parque de la Marina / Bahía
      ctx.beginPath();
      ctx.roundRect(620, 320, 100, 200, 12);
      ctx.fillStyle = "#122014";
      ctx.fill();
      ctx.stroke();

      // 4. Bloques Urbanos (Manzanas de la ciudad)
      CITY_BLOCKS.forEach((block) => {
        // Optimización de frustum culling: sólo dibujar los visibles
        if (
          block.x + block.w < camX - 500 ||
          block.x > camX + 500 ||
          block.y + block.h < camY - 400 ||
          block.y > camY + 400
        ) {
          return;
        }

        ctx.beginPath();
        ctx.roundRect(block.x, block.y, block.w, block.h, 6);
        ctx.fillStyle = "#151c15";
        ctx.fill();
        ctx.strokeStyle = "#1f281f";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Huellas interiores de edificios para textura realista
        ctx.fillStyle = "#1a231a";
        ctx.fillRect(block.x + 8, block.y + 8, block.w * 0.42, block.h * 0.45);
        ctx.fillRect(
          block.x + block.w * 0.52,
          block.y + block.h * 0.5,
          block.w * 0.38,
          block.h * 0.38
        );
      });

      // 5. Red Vial (Calles secundarias y Avenidas principales)
      // Calles secundarias
      ctx.strokeStyle = "#1b231a";
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let y = 200; y <= 1400; y += 140) {
        ctx.moveTo(700, y);
        ctx.lineTo(2150, y);
      }
      for (let x = 750; x <= 2150; x += 180) {
        ctx.moveTo(x, 200);
        ctx.lineTo(x, 1400);
      }
      ctx.stroke();

      // Avenidas Principales
      ctx.strokeStyle = "#253123";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Av. Este-Oeste
      ctx.beginPath();
      ctx.moveTo(560, 350);
      ctx.lineTo(2200, 350);
      ctx.moveTo(580, 1100);
      ctx.lineTo(2200, 1100);
      ctx.moveTo(680, 1340);
      ctx.lineTo(2200, 1340);
      // Av. Norte-Sur
      ctx.moveTo(1300, 150);
      ctx.lineTo(1300, 1500);
      ctx.moveTo(1950, 150);
      ctx.lineTo(1950, 1500);
      ctx.stroke();

      // Glorieta Circular en intersección (x: 1300, y: 950)
      ctx.beginPath();
      ctx.arc(1300, 950, 52, 0, Math.PI * 2);
      ctx.fillStyle = "#253123";
      ctx.fill();
      ctx.strokeStyle = "#384a34";
      ctx.lineWidth = 10;
      ctx.stroke();

      // Isla central verde de la glorieta
      ctx.beginPath();
      ctx.arc(1300, 950, 24, 0, Math.PI * 2);
      ctx.fillStyle = "#122014";
      ctx.fill();
      ctx.strokeStyle = "rgba(178, 206, 168, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Viaducto / Puente sobre la bahía (del Malecón hacia la isla)
      ctx.strokeStyle = "#080c09";
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(530, 720);
      ctx.lineTo(420, 780);
      ctx.lineTo(280, 830);
      ctx.lineTo(250, 920);
      ctx.lineTo(370, 990);
      ctx.lineTo(580, 1060);
      ctx.stroke();

      // Superficie del viaducto
      ctx.strokeStyle = "#2a3928";
      ctx.lineWidth = 11;
      ctx.stroke();

      // Barandillas luminosas del puente
      ctx.strokeStyle = "rgba(178, 206, 168, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Autopista del Malecón Costero
      ctx.strokeStyle = "#2b3b28";
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(550, 100);
      ctx.lineTo(550, 250);
      ctx.lineTo(570, 480);
      ctx.lineTo(530, 720);
      ctx.lineTo(580, 1060);
      ctx.lineTo(620, 1400);
      ctx.stroke();

      // Líneas divisorias de carril (guiones reflectantes)
      ctx.strokeStyle = "rgba(178, 206, 168, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(550, 100);
      ctx.lineTo(550, 250);
      ctx.lineTo(570, 480);
      ctx.lineTo(530, 720);
      ctx.lineTo(580, 1060);
      ctx.lineTo(620, 1400);

      ctx.moveTo(560, 350);
      ctx.lineTo(2200, 350);
      ctx.moveTo(1300, 150);
      ctx.lineTo(1300, 1500);
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // Nombres de calles en tipografía táctica
      ctx.fillStyle = "rgba(178, 206, 168, 0.4)";
      ctx.font = "700 9px monospace";
      ctx.letterSpacing = "2px";

      ctx.save();
      ctx.translate(525, 450);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText("AV. DEL MALECÓN", 0, 0);
      ctx.restore();

      ctx.fillText("AV. PEDRO DE HEREDIA", 1400, 342);
      ctx.fillText("CORREDOR DE CARGA", 1100, 1332);
      ctx.fillText("PARQUE CENTRAL", 1390, 570);
      ctx.fillText("BAHÍA DE CARTAGENA", 140, 680);
      ctx.fillText("VIADUCTO DEL MAR", 280, 810);

      // 6. ESTELA LUMINOSA DEL RECORRIDO (BREADCRUMB TRAIL)
      // Representa la ruta trazada por el GPS que va quedando atrás
      const TRAIL_LENGTH = 80;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let i = 1; i <= TRAIL_LENGTH; i++) {
        const prevIdx = (curIdx - TRAIL_LENGTH + (i - 1) + totalPoints) % totalPoints;
        const thisIdx = (curIdx - TRAIL_LENGTH + i + totalPoints) % totalPoints;
        const pPrev = ROUTE_POINTS[prevIdx];
        const pThis = ROUTE_POINTS[thisIdx];
        const ratio = i / TRAIL_LENGTH;

        ctx.beginPath();
        ctx.moveTo(pPrev.x, pPrev.y);
        ctx.lineTo(pThis.x, pThis.y);

        // Gradiente de luminosidad: tenue al inicio, resplandeciente cerca del vehículo
        ctx.strokeStyle = `rgba(178, 206, 168, ${ratio * 0.85})`;
        ctx.lineWidth = 1.8 + ratio * 2.2;

        if (i > TRAIL_LENGTH - 12) {
          ctx.shadowColor = "#b2cea8";
          ctx.shadowBlur = 9;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // 7. VEHÍCULO / LOCALIZADOR GPS EN MOVIMIENTO
      const carX = currentPoint.x;
      const carY = currentPoint.y;
      const heading = currentPoint.heading;

      ctx.save();
      ctx.translate(carX, carY);
      ctx.rotate(heading);

      // Cono de haz de detección / radar delantero
      const coneGradient = ctx.createRadialGradient(0, 0, 6, 0, 0, 65);
      coneGradient.addColorStop(0, "rgba(178, 206, 168, 0.28)");
      coneGradient.addColorStop(0.5, "rgba(178, 206, 168, 0.08)");
      coneGradient.addColorStop(1, "rgba(178, 206, 168, 0)");

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 65, -0.4, 0.4);
      ctx.closePath();
      ctx.fillStyle = coneGradient;
      ctx.fill();

      // Ondas concéntricas de pulso GPS
      const maxPulseR = 28;
      const pulseR1 = 6 + pulseProgress * maxPulseR;
      const pulseAlpha1 = Math.max(0, 1 - pulseProgress);

      ctx.beginPath();
      ctx.arc(0, 0, pulseR1, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(178, 206, 168, ${pulseAlpha1 * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const pulseProgress2 = (pulseProgress + 0.5) % 1;
      const pulseR2 = 6 + pulseProgress2 * maxPulseR;
      const pulseAlpha2 = Math.max(0, 1 - pulseProgress2);

      ctx.beginPath();
      ctx.arc(0, 0, pulseR2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(178, 206, 168, ${pulseAlpha2 * 0.7})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Resplandor del núcleo
      ctx.shadowColor = "#b2cea8";
      ctx.shadowBlur = 14;

      // Anillo exterior del vehículo
      ctx.beginPath();
      ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = "#b2cea8";
      ctx.fill();

      // Flecha indicadora de dirección (heading chevron)
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-4, -3.5);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 3.5);
      ctx.closePath();
      ctx.fillStyle = "#141c13";
      ctx.fill();

      // Punto blanco de precisión satelital
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore(); // Fin del dibujo del vehículo

      ctx.restore(); // Fin de la transformación de cámara

      // Viñeta perimetral sobre el canvas para acabado integrado
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.35,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, "rgba(18, 22, 15, 0)");
      vignette.addColorStop(1, "rgba(14, 18, 13, 0.85)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      ctx.restore(); // Fin de DPI scale

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [onTelemetryUpdate]);

  return (
    <div className="mini-mapa-hero-container" ref={containerRef}>
      <canvas ref={canvasRef} className="mini-mapa-canvas" />

      {/* Retícula de esquinas estilo visor táctico militar/industrial */}
      <div className="mini-mapa-esquina esquina-tl" />
      <div className="mini-mapa-esquina esquina-tr" />
      <div className="mini-mapa-esquina esquina-bl" />
      <div className="mini-mapa-esquina esquina-br" />

      {/* Badge superior izquierdo: Estado en vivo */}
      <div className="mini-mapa-badge-status">
        <span className="mini-mapa-led-pulso" />
        <span className="mini-mapa-texto-status">GPS VIVO • 10 HZ</span>
      </div>

      {/* Brújula norte superior derecha */}
      <div className="mini-mapa-brujula" title="Orientación Norte">
        <span className="brujula-flecha">▲</span>
        <span className="brujula-n">N</span>
      </div>

      {/* Barra de escala inferior izquierda */}
      <div className="mini-mapa-escala">
        <span className="escala-texto">150 m</span>
        <div className="escala-linea">
          <span className="escala-tick-izq" />
          <span className="escala-barra" />
          <span className="escala-tick-der" />
        </div>
      </div>

      {/* Telemetría satelital inferior derecha */}
      <div className="mini-mapa-tag-satelite">
        <span className="sat-item">
          <strong>SAT:</strong> {HUD_DATA.satelites}
        </span>
        <span className="sat-sep">|</span>
        <span className="sat-item">{HUD_DATA.modo}</span>
      </div>
    </div>
  );
}
