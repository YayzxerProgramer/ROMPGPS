import { useEffect, useRef, useState } from "react";
import { get } from "../../Service/api";
import { ROLES, numero } from "./adminUtils";

const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/** Barras horizontales de una serie: valor en la punta y tooltip al pasar. */
function BarrasH({ filas, total, formato = numero }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const maximo = Math.max(1, ...filas.map((f) => f.valor));

  const mover = (e, f) => {
    const caja = ref.current.getBoundingClientRect();
    setTip({
      x: e.clientX - caja.left,
      y: e.clientY - caja.top,
      titulo: f.etiqueta,
      valor: formato(f.valor),
      extra: total ? `${pct(f.valor, total)} % del total` : null,
    });
  };

  return (
    <div className="adm-barras" ref={ref} onMouseLeave={() => setTip(null)}>
      {filas.map((f) => (
        <div key={f.etiqueta} className="adm-barra-fila" onMouseMove={(e) => mover(e, f)}>
          <span className="adm-barra-etiqueta">
            {f.color && <span className="adm-barra-clave" style={{ background: f.color }} />}
            {f.etiqueta}
          </span>
          <span className="adm-barra-pista">
            <span
              className="adm-barra"
              // Se reserva sitio para el valor en la punta sin deformar la escala.
              style={{ width: `calc((100% - 64px) * ${f.valor / maximo})`, background: f.color || undefined }}
            />
            <span className="adm-barra-valor">{formato(f.valor)}</span>
          </span>
        </div>
      ))}
      {tip && (
        <div className="adm-tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.valor}</b>
          <span>{tip.titulo}</span>
          {tip.extra && <span className="adm-tooltip-extra">{tip.extra}</span>}
        </div>
      )}
    </div>
  );
}

/** Medidor de proporción: relleno en acento, pista en un paso más claro del mismo tono. */
function Medidor({ etiqueta, parte, total, aviso }) {
  const p = pct(parte, total);
  return (
    <div className="adm-medidor" title={`${numero(parte)} de ${numero(total)}`}>
      <div className="adm-medidor-cab">
        <span>{etiqueta}</span>
        <b>{p}<small> %</small></b>
      </div>
      <div className="adm-medidor-pista"><div style={{ width: `${p}%` }} /></div>
      <div className="adm-medidor-pie">
        {numero(parte)} de {numero(total)}
        {aviso && total - parte > 0 && <span className="adm-medidor-aviso">· {numero(total - parte)} {aviso}</span>}
      </div>
    </div>
  );
}

export default function AdminAnalitica({ resumen, conteoEstados, totalMonitorizadas }) {
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState(null);

  // Una consulta por rol con tamano=1: solo interesa totalElementos.
  useEffect(() => {
    Promise.all(Object.keys(ROLES).map((rol) =>
      get(`/admin/usuarios?rol=${rol}&tamano=1`).then((p) => [rol, p.totalElementos])))
      .then((pares) => setRoles(Object.fromEntries(pares)))
      .catch((e) => setError(e.message));
  }, []);

  const r = resumen || {};
  const cobertura = pct(r.vehiculosConImei, r.totalVehiculos);
  const conPosicion = (conteoEstados.marcha || 0) + (conteoEstados.detenido || 0);

  const filasRoles = Object.entries(ROLES).map(([rol, etiqueta]) => ({
    etiqueta,
    valor: roles?.[rol] ?? 0,
  }));

  const filasEstados = [
    { clave: "marcha", etiqueta: "En marcha", color: "#b2cea8" },
    { clave: "detenido", etiqueta: "Detenida", color: "#c9cfc6" },
    { clave: "sin", etiqueta: "Sin datos", color: "#6f776c" },
    { clave: "nogps", etiqueta: "Sin GPS", color: "#e0b97a" },
    { clave: "off", etiqueta: "Inactiva", color: "#e0a391" },
  ].map((e) => ({ etiqueta: e.etiqueta, valor: conteoEstados[e.clave] || 0, color: e.color }));

  return (
    <div className="adm-seccion">
      <div className="adm-encabezado">
        <div>
          <div className="adm-encabezado-meta">
            <span className="adm-en-vivo"><span className="material-symbols-outlined">monitoring</span>ANALÍTICA</span>
            <span className="adm-encabezado-nota">Datos en tiempo real del sistema</span>
          </div>
          <h1 className="adm-titulo">Salud de la <em>plataforma</em></h1>
          <p className="adm-subtitulo">Cobertura de equipos, actividad de usuarios y estado de la flota.</p>
        </div>
      </div>

      {error && <div className="adm-error"><span className="material-symbols-outlined">error</span>{error}</div>}

      <div className="adm-analitica">
        <div className="adm-tarjeta adm-heroe">
          <div className="adm-etiqueta adm-etiqueta--acento">EQUIPOS ASIGNADOS</div>
          <div className="adm-heroe-valor">{cobertura}<small>%</small></div>
          <p className="adm-heroe-texto">
            {numero(r.vehiculosConImei)} de {numero(r.totalVehiculos)} vehículos tienen un equipo GT06 asignado. Revisa en «Estado de las unidades» cuáles están reportando.
          </p>
          <div className="adm-medidor-pista adm-medidor-pista--heroe"><div style={{ width: `${cobertura}%` }} /></div>
        </div>

        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Inventario</div>
              <div className="adm-tarjeta-sub">Proporción sobre {numero(r.totalVehiculos)} vehículos</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">inventory_2</span>
          </div>
          <div className="adm-medidores">
            <Medidor etiqueta="Con propietario" parte={(r.totalVehiculos || 0) - (r.vehiculosSinDuenno || 0)} total={r.totalVehiculos} aviso="sin asignar" />
            <Medidor etiqueta="Vehículos habilitados" parte={r.vehiculosActivos} total={r.totalVehiculos} aviso="deshabilitados" />
          </div>
        </div>

        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Usuarios por rol</div>
              <div className="adm-tarjeta-sub">{numero(r.totalUsuarios)} cuentas · {pct(r.usuariosActivos, r.totalUsuarios)} % activas</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">group</span>
          </div>
          {roles ? <BarrasH filas={filasRoles} total={r.totalUsuarios} /> : <div className="adm-tabla-vacia">Calculando…</div>}
        </div>

        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Estado de las unidades</div>
              <div className="adm-tarjeta-sub">{numero(conPosicion)} de {numero(totalMonitorizadas)} han reportado posición · unidades más recientes</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">radar</span>
          </div>
          <BarrasH filas={filasEstados} total={totalMonitorizadas} />
        </div>
      </div>
    </div>
  );
}
