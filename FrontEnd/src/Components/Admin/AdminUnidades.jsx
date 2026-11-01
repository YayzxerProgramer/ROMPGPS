import { useCallback, useEffect, useState } from "react";
import { del, get, patch } from "../../Service/api";
import { Confirmar, InsigniaEstado, Modal, Paginacion, Segmentos, Vacio } from "./AdminUI";
import { useAvisar } from "./avisos";
import { FormVehiculo, FormVincular } from "./AdminFormularios";
import MantenimientoVehiculo from "../Mantenimiento/MantenimientoVehiculo";
import {
  ESTADOS, fecha, haceCuanto,
  contar, iniciales, query,
} from "./adminUtils";

const FILTRO_ESTADO = [
  { valor: "", etiqueta: "Todos" },
  { valor: "true", etiqueta: "Activos" },
  { valor: "false", etiqueta: "Inactivos" },
];

const TAMANO = 15;

export default function AdminUnidades({ busqueda, dialogoInicial, onDialogoAbierto, onCambio, onUbicar }) {
  const avisar = useAvisar();

  const [activo, setActivo] = useState("");
  // La página va ligada a los filtros: al cambiar cualquiera vuelve a la 0.
  const filtros = `${busqueda}|${activo}`;
  const [paginaDe, setPaginaDe] = useState({ filtros, n: 0 });
  const pagina = paginaDe.filtros === filtros ? paginaDe.n : 0;
  const setPagina = (n) => setPaginaDe({ filtros, n });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // "Vincular" desde el resumen llega con su diálogo ya abierto.
  const [dialogo, setDialogo] = useState(() => dialogoInicial);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const pag = await get(`/admin/vehiculos${query({ busqueda, activo, pagina, tamano: TAMANO })}`);
      setDatos(pag);
      setAhora(Date.now());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda, activo, pagina]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  useEffect(() => {
    if (dialogoInicial) onDialogoAbierto();
  }, [dialogoInicial, onDialogoAbierto]);

  const tras = (_, mensaje) => {
    avisar(mensaje);
    cargar();
    onCambio();
  };

  const alternarEstado = async (v) => {
    try {
      await patch(`/admin/vehiculos/${v.id}/estado`);
      avisar(v.activo ? `${v.placa} desactivado` : `${v.placa} activado`);
      cargar();
      onCambio();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const vehiculos = datos?.contenido || [];

  return (
    <div className="adm-seccion">
      <div className="adm-encabezado">
        <div>
          <div className="adm-encabezado-meta">
            <span className="adm-en-vivo"><span className="material-symbols-outlined">satellite_alt</span>INVENTARIO</span>
            {datos && <span className="adm-encabezado-nota">{contar(datos.totalElementos, "vehículo")}</span>}
          </div>
          <h1 className="adm-titulo">Unidades <em>GPS</em></h1>
          <p className="adm-subtitulo">Equipos GT06, sus vehículos y a quién pertenecen.</p>
        </div>
        <div className="adm-encabezado-acciones">
          <button className="adm-btn-secundario" onClick={() => setDialogo({ tipo: "vincular" })}>
            <span className="material-symbols-outlined">link</span>Vincular
          </button>
          <button className="adm-btn-primario" onClick={() => setDialogo({ tipo: "crear" })}>
            <span className="material-symbols-outlined">add</span>Registrar equipo
          </button>
        </div>
      </div>

      <div className="adm-filtros">
        <div className="adm-filtro">
          <span className="adm-etiqueta">RASTREO</span>
          <Segmentos opciones={FILTRO_ESTADO} valor={activo} onCambiar={setActivo} pequeno />
        </div>
        {busqueda && <span className="adm-filtro-nota">Filtrando por «{busqueda}»</span>}
      </div>

      {error && (
        <div className="adm-error" role="alert">
          <span className="material-symbols-outlined">error</span>{error}
          <button className="adm-enlace adm-error-accion" onClick={cargar}>REINTENTAR</button>
        </div>
      )}

      <div className="adm-tabla-tarjeta">
        <div className="adm-tabla-scroll">
          <div className="adm-tabla adm-tabla--unidades">
            <div className="adm-tabla-fila adm-tabla-fila--cab">
              <span>PLACA / IMEI</span><span>PROPIETARIO</span><span>MODELO</span><span>SEÑAL</span><span>ALTA</span><span className="der">ACCIONES</span>
            </div>

            {cargando && vehiculos.length === 0 && <div className="adm-tabla-vacia">Cargando inventario…</div>}
            {!cargando && !error && vehiculos.length === 0 && (
              <Vacio
                icono="satellite_alt"
                titulo="Sin vehículos"
                texto={busqueda ? "Ningún vehículo coincide con la búsqueda." : "Registra el primer equipo para empezar."}
                accion={!busqueda && (
                  <button className="adm-btn-primario" onClick={() => setDialogo({ tipo: "crear" })}>
                    <span className="material-symbols-outlined">add</span>Registrar equipo
                  </button>
                )}
              />
            )}

            {vehiculos.map((v) => {
              const duenno = v.propietario;
              const pos = v.ultimaPosicion;
              const estado = v.estado || "sin";
              const nombreDuennio = v.nombrePropietario || "Sin asignar";
              return (
                <div key={v.id} className="adm-tabla-fila" onClick={() => setDialogo({ tipo: "editar", vehiculo: v })}>
                  <div>
                    <div className="adm-placa">{v.placa}</div>
                    <div className={`adm-imei ${v.imei ? "" : "adm-tono--nogps"}`}>{v.imei || "SIN GPS"}</div>
                  </div>
                  <div className="adm-propietario">
                    <span className="adm-iniciales">{duenno ? iniciales(nombreDuennio) : "—"}</span>
                    <span className="adm-celda-doble">
                      <b className={duenno ? "" : "adm-tenue"}>{nombreDuennio}</b>
                      {duenno && <span>@{duenno.usuario}</span>}
                    </span>
                  </div>
                  <div className="adm-modelo">
                    <span className="material-symbols-outlined adm-modelo-icono">{v.tipo === "CARRO" ? "directions_car" : "two_wheeler"}</span>
                    {v.modelo}
                  </div>
                  <div className="adm-celda-doble">
                    <InsigniaEstado estado={estado} texto={ESTADOS[estado] || estado} />
                    {pos && <span className="adm-celda-mono">{haceCuanto(pos.fecha, ahora)}</span>}
                  </div>
                  <div className="adm-alta">{fecha(v.creadoEn)}</div>
                  <div className="der adm-acciones" onClick={(e) => e.stopPropagation()}>
                    {pos && (
                      <button className="adm-accion" title="Ubicar en el monitor" onClick={() => onUbicar(v.id)}>
                        <span className="material-symbols-outlined">my_location</span>
                      </button>
                    )}
                    <MantenimientoVehiculo idVehiculo={v.id} etiqueta={`${v.modelo} · ${v.placa}`} variante="icono" claseBoton="adm-accion" />
                    <button className="adm-accion" title="Vincular propietario" onClick={() => setDialogo({ tipo: "vincular", vehiculo: v, propietario: duenno })}>
                      <span className="material-symbols-outlined">link</span>
                    </button>
                    <button className="adm-accion" title={v.activo ? "Desactivar rastreo" : "Activar rastreo"} onClick={() => alternarEstado(v)}>
                      <span className="material-symbols-outlined">{v.activo ? "toggle_on" : "toggle_off"}</span>
                    </button>
                    <button className="adm-accion adm-accion--peligro" title="Eliminar" onClick={() => setDialogo({ tipo: "eliminar", vehiculo: v })}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Paginacion
          pagina={pagina}
          totalPaginas={datos?.totalPaginas || 0}
          totalElementos={datos?.totalElementos || 0}
          onCambiar={setPagina}
          singular="vehículo"
        />
      </div>

      {dialogo?.tipo === "crear" && <FormVehiculo onCerrar={() => setDialogo(null)} onGuardado={tras} />}
      {dialogo?.tipo === "editar" && <FormVehiculo vehiculo={dialogo.vehiculo} onCerrar={() => setDialogo(null)} onGuardado={tras} />}
      {dialogo?.tipo === "vincular" && (
        dialogo.vehiculo
          ? <FormVincular vehiculo={dialogo.vehiculo} propietarioActual={dialogo.propietario} onCerrar={() => setDialogo(null)} onGuardado={tras} />
          : <ElegirVehiculo onCerrar={() => setDialogo(null)} onElegir={(v) => {
              setDialogo({ tipo: "vincular", vehiculo: v, propietario: v.propietario });
            }} />
      )}
      {dialogo?.tipo === "eliminar" && (
        <Confirmar
          titulo="Eliminar vehículo"
          peligro
          icono="delete"
          textoConfirmar="Eliminar"
          mensaje={`Se eliminará ${dialogo.vehiculo.placa} (${dialogo.vehiculo.modelo}). Su histórico de posiciones se conserva, pero el equipo dejará de aparecer en el panel.`}
          onConfirmar={async () => {
            await del(`/admin/vehiculos/${dialogo.vehiculo.id}`);
            tras(null, "Vehículo eliminado");
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  );
}

/** Paso previo de "Vincular" cuando no se parte de un vehículo concreto. */
function ElegirVehiculo({ onCerrar, onElegir }) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    const id = setTimeout(() => {
      get(`/admin/vehiculos${query({ busqueda: texto, tamano: 6 })}`)
        .then((p) => setResultados(p.contenido))
        .catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(id);
  }, [texto]);

  return (
    <ModalElegir onCerrar={onCerrar}>
      <div className="adm-entrada adm-entrada--icono">
        <span className="material-symbols-outlined">search</span>
        <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Placa, modelo o IMEI…" />
      </div>
      <div className="adm-selector-lista">
        {resultados.length === 0 && <div className="adm-selector-vacio">Sin coincidencias</div>}
        {resultados.map((v) => (
          <button key={v.id} type="button" className="adm-selector-item" onClick={() => onElegir(v)}>
            <span className="adm-iniciales"><span className="material-symbols-outlined">{v.tipo === "CARRO" ? "directions_car" : "two_wheeler"}</span></span>
            <span className="adm-selector-texto">
              <b>{v.placa}</b>
              <span>{v.modelo} · {v.id_usuario ? "con propietario" : "sin propietario"}</span>
            </span>
          </button>
        ))}
      </div>
    </ModalElegir>
  );
}

function ModalElegir({ onCerrar, children }) {
  return (
    <Modal titulo="Vincular vehículo y usuario" subtitulo="Paso 1 de 2 · elige el vehículo" icono="link" onCerrar={onCerrar} ancho={520}>
      <div className="adm-selector">{children}</div>
    </Modal>
  );
}
