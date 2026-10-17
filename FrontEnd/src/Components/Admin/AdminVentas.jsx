import { useCallback, useEffect, useState } from "react";
import { del, get, patch, post } from "../../Service/api";
import { Confirmar, InsigniaEstado, Modal, Paginacion, Segmentos, SelectorUsuario } from "./AdminUI";
import { useAvisar } from "./avisos";
import { PLANES, contar, fecha, formatoMoneda, iniciales, numero, query } from "./adminUtils";

const FILTRO_PLAN = [
  { valor: "", etiqueta: "Todos" },
  { valor: "PERSONAL", etiqueta: "Personal" },
  { valor: "PRO", etiqueta: "Pro" },
  { valor: "ENTERPRISE", etiqueta: "Enterprise" },
];

const FILTRO_ESTADO_VENTA = [
  { valor: "", etiqueta: "Todos" },
  { valor: "APROBADO", etiqueta: "Aprobadas" },
  { valor: "PENDIENTE", etiqueta: "Pendientes" },
  { valor: "CANCELADO", etiqueta: "Canceladas" },
];

const PRECIOS_BASE = {
  PERSONAL: { mensual: 24900, anual: 239040 },
  PRO: { mensual: 44900, anual: 431040 },
  ENTERPRISE: { mensual: 79900, anual: 767040 },
};

const TAMANO_PAGINA = 10;

export default function AdminVentas({ busqueda }) {
  const avisar = useAvisar();

  const [estadisticas, setEstadisticas] = useState(null);
  const [planFiltro, setPlanFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const filtros = `${busqueda}|${planFiltro}|${estadoFiltro}`;
  const [paginaDe, setPaginaDe] = useState({ filtros, n: 0 });
  const pagina = paginaDe.filtros === filtros ? paginaDe.n : 0;
  const setPagina = (n) => setPaginaDe({ filtros, n });

  const [ventasData, setVentasData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modalNuevaVenta, setModalNuevaVenta] = useState(false);
  const [ventaAEliminar, setVentaAEliminar] = useState(null);
  const [ventaDetalle, setVentaDetalle] = useState(null);

  const cargarEstadisticas = useCallback(async () => {
    try {
      const stats = await get("/admin/ventas/estadisticas");
      setEstadisticas(stats);
    } catch (e) {
      console.warn("No se pudieron cargar estadísticas de ventas:", e.message);
    }
  }, []);

  const cargarVentas = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await get(
        `/admin/ventas${query({
          busqueda,
          plan: planFiltro,
          estado: estadoFiltro,
          pagina,
          tamano: TAMANO_PAGINA,
        })}`
      );
      setVentasData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda, planFiltro, estadoFiltro, pagina]);

  useEffect(() => {
    cargarEstadisticas();
  }, [cargarEstadisticas]);

  useEffect(() => {
    const id = setTimeout(cargarVentas, 300);
    return () => clearTimeout(id);
  }, [cargarVentas]);

  const alternarEstadoVenta = async (v, nuevoEstado) => {
    try {
      await patch(`/admin/ventas/${v.id}/estado`, { estado: nuevoEstado });
      avisar(`Venta ${v.referencia} marcada como ${nuevoEstado}`);
      cargarVentas();
      cargarEstadisticas();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const eliminarVentaConfirmada = async () => {
    if (!ventaAEliminar) return;
    try {
      await del(`/admin/ventas/${ventaAEliminar.id}`);
      avisar("Venta eliminada del registro");
      setVentaAEliminar(null);
      cargarVentas();
      cargarEstadisticas();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const exportarCsvVentas = () => {
    const filas = (ventasData?.contenido || []).map((v) =>
      [
        `"${v.referencia}"`,
        `"${v.clienteNombre}"`,
        `"${v.clienteCorreo}"`,
        v.plan,
        v.monto,
        v.periodo,
        v.metodoPago,
        v.estado,
        `"${v.creadoEn}"`,
      ].join(",")
    );
    const cabecera = "referencia,cliente,correo,plan,monto,periodo,metodo,estado,fecha\n";
    const blob = new Blob([cabecera + filas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-rompgps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const listaVentas = ventasData?.contenido || [];
  const s = estadisticas;

  return (
    <div className="adm-seccion">
      {/* ── Encabezado ── */}
      <div className="adm-encabezado">
        <div>
          <div className="adm-encabezado-meta">
            <span className="adm-en-vivo">
              <span className="material-symbols-outlined">payments</span>VENTAS & FACTURACIÓN
            </span>
            {ventasData && (
              <span className="adm-encabezado-nota">
                {contar(ventasData.totalElementos, "transacción", "transacciones")}
              </span>
            )}
          </div>
          <h1 className="adm-titulo">
            Estadísticas de <em>ventas</em>
          </h1>
          <p className="adm-subtitulo">
            Métricas de ingresos, suscripciones activas y facturación por planes.
          </p>
        </div>
        <div className="adm-encabezado-acciones">
          <button className="adm-btn-secundario" onClick={exportarCsvVentas} disabled={listaVentas.length === 0}>
            <span className="material-symbols-outlined">download</span>Exportar CSV
          </button>
          <button className="adm-btn-primario" onClick={() => setModalNuevaVenta(true)}>
            <span className="material-symbols-outlined">add_card</span>Registrar venta
          </button>
        </div>
      </div>

      {error && (
        <div className="adm-error">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      {/* ── Métricas y KPIs de Ventas ── */}
      <div className="adm-kpis-grid">
        <div className="adm-tarjeta adm-heroe">
          <div className="adm-etiqueta adm-etiqueta--acento">INGRESOS TOTALES (COP)</div>
          <div className="adm-heroe-valor">
            {formatoMoneda(s?.totalIngresos)}
          </div>
          <p className="adm-heroe-texto">
            Generados a través de suscripciones y ventas confirmadas en la plataforma.
          </p>
          <div className="adm-medidor-pista adm-medidor-pista--heroe">
            <div style={{ width: "100%" }} />
          </div>
        </div>

        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Ventas aprobadas</div>
              <div className="adm-tarjeta-sub">Transacciones completadas</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">check_circle</span>
          </div>
          <div className="adm-stat-grande">{numero(s?.ventasAprobadas || 0)}</div>
          <div className="adm-stat-detalle">
            <span>Ticket promedio: <b>{formatoMoneda(s?.ticketPromedio)}</b></span>
          </div>
        </div>

        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">En validación</div>
              <div className="adm-tarjeta-sub">Pagos por confirmar</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">pending</span>
          </div>
          <div className="adm-stat-grande adm-tono--ambar">{numero(s?.ventasPendientes || 0)}</div>
          <div className="adm-stat-detalle">
            <span>Canceladas / rechazadas: {numero(s?.ventasCanceladas || 0)}</span>
          </div>
        </div>
      </div>

      {/* ── Distribución de Ventas ── */}
      <div className="adm-analitica" style={{ marginTop: "1rem" }}>
        {/* Distribución por Plan */}
        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Ventas por Plan</div>
              <div className="adm-tarjeta-sub">Ingresos derivados por cada tipo de plan</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">subscriptions</span>
          </div>
          <div className="adm-barras">
            {(s?.porPlan || []).map((p) => (
              <div key={p.plan} className="adm-barra-fila">
                <span className="adm-barra-etiqueta">
                  <span
                    className="adm-barra-clave"
                    style={{
                      background:
                        p.plan === "ENTERPRISE"
                          ? "#e0b97a"
                          : p.plan === "PRO"
                          ? "#b2cea8"
                          : "#6f776c",
                    }}
                  />
                  {p.nombre}
                </span>
                <span className="adm-barra-pista">
                  <span
                    className="adm-barra"
                    style={{
                      width: `${Math.max(5, p.porcentaje)}%`,
                      background:
                        p.plan === "ENTERPRISE"
                          ? "#e0b97a"
                          : p.plan === "PRO"
                          ? "#b2cea8"
                          : "#6f776c",
                    }}
                  />
                  <span className="adm-barra-valor">
                    {p.cantidad} ({formatoMoneda(p.totalMonto)})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Métodos de Pago y Periodicidad */}
        <div className="adm-tarjeta">
          <div className="adm-tarjeta-cab">
            <div>
              <div className="adm-tarjeta-titulo">Métodos de Pago</div>
              <div className="adm-tarjeta-sub">Pasarelas y medios más usados</div>
            </div>
            <span className="material-symbols-outlined adm-tarjeta-icono">account_balance_wallet</span>
          </div>
          <div className="adm-barras">
            {(s?.porMetodo || []).map((m) => (
              <div key={m.metodo} className="adm-barra-fila">
                <span className="adm-barra-etiqueta">{m.metodo}</span>
                <span className="adm-barra-pista">
                  <span
                    className="adm-barra"
                    style={{ width: `${Math.max(8, m.porcentaje)}%`, background: "#95ad91" }}
                  />
                  <span className="adm-barra-valor">
                    {m.cantidad} · {formatoMoneda(m.totalMonto)}
                  </span>
                </span>
              </div>
            ))}
            {(s?.porMetodo || []).length === 0 && (
              <div className="adm-tabla-vacia">Sin datos de métodos aún</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Filtros de la Tabla ── */}
      <div className="adm-filtros" style={{ marginTop: "1.5rem" }}>
        <div className="adm-filtro">
          <span className="adm-etiqueta">PLAN</span>
          <Segmentos opciones={FILTRO_PLAN} valor={planFiltro} onCambiar={setPlanFiltro} />
        </div>
        <div className="adm-filtro">
          <span className="adm-etiqueta">ESTADO</span>
          <Segmentos
            opciones={FILTRO_ESTADO_VENTA}
            valor={estadoFiltro}
            onCambiar={setEstadoFiltro}
          />
        </div>
      </div>

      {/* ── Tabla de Ventas ── */}
      <div className="adm-tabla-tarjeta">
        <div className="adm-tabla-cab">
          <div>
            <div className="adm-tabla-titulo">Registro de Ventas</div>
            <div className="adm-tabla-sub">
              Detalle de cada orden de suscripción y facturación procesada.
            </div>
          </div>
        </div>

        <div className="adm-tabla-scroll">
          <div className="adm-tabla">
            <div className="adm-tabla-fila adm-tabla-fila--cab">
              <span>REFERENCIA / FECHA</span>
              <span>CLIENTE</span>
              <span>PLAN</span>
              <span>MONTO</span>
              <span>PERIODO</span>
              <span>MÉTODO</span>
              <span>ESTADO</span>
              <span className="der">ACCIONES</span>
            </div>

            {cargando && listaVentas.length === 0 && (
              <div className="adm-tabla-vacia">Cargando ventas…</div>
            )}

            {!cargando && listaVentas.length === 0 && (
              <div className="adm-tabla-vacia">
                {busqueda || planFiltro || estadoFiltro
                  ? "Sin resultados para los filtros seleccionados"
                  : "No hay ventas registradas todavía"}
              </div>
            )}

            {listaVentas.map((v) => {
              const clasePlan =
                v.plan === "ENTERPRISE"
                  ? "adm-insignia--dorado"
                  : v.plan === "PRO"
                  ? "adm-insignia--verde"
                  : "adm-insignia--gris";

              const estadoTipo =
                v.estado === "APROBADO"
                  ? "marcha"
                  : v.estado === "PENDIENTE"
                  ? "nogps"
                  : "off";

              return (
                <div key={v.id} className="adm-tabla-fila">
                  <div>
                    <div className="adm-placa" style={{ fontSize: "12px", fontFamily: "monospace" }}>
                      {v.referencia}
                    </div>
                    <div className="adm-subtexto" style={{ fontSize: "11px", color: "var(--adm-texto-4)" }}>
                      {fecha(v.creadoEn)}
                    </div>
                  </div>

                  <div className="adm-propietario">
                    <span className="adm-iniciales">{iniciales(v.clienteNombre)}</span>
                    <span className="adm-celda-doble">
                      <b>{v.clienteNombre}</b>
                      <span>{v.clienteCorreo}</span>
                    </span>
                  </div>

                  <div>
                    <span className={`adm-insignia ${clasePlan}`}>
                      {PLANES[v.plan] || v.plan}
                    </span>
                  </div>

                  <div>
                    <b style={{ color: "var(--adm-texto)", fontSize: "13px" }}>
                      {formatoMoneda(v.monto)}
                    </b>
                  </div>

                  <div>
                    <span className="adm-subtexto">{v.periodo}</span>
                  </div>

                  <div>
                    <span className="adm-subtexto">{v.metodoPago}</span>
                  </div>

                  <div>
                    <InsigniaEstado estado={estadoTipo} texto={v.estado} />
                  </div>

                  <div className="der adm-acciones">
                    {v.estado === "PENDIENTE" && (
                      <button
                        className="adm-accion"
                        title="Aprobar venta"
                        onClick={() => alternarEstadoVenta(v, "APROBADO")}
                      >
                        <span className="material-symbols-outlined" style={{ color: "#b2cea8" }}>
                          check_circle
                        </span>
                      </button>
                    )}
                    {v.estado === "APROBADO" && (
                      <button
                        className="adm-accion"
                        title="Cancelar / Revertir venta"
                        onClick={() => alternarEstadoVenta(v, "CANCELADO")}
                      >
                        <span className="material-symbols-outlined" style={{ color: "#e0a391" }}>
                          cancel
                        </span>
                      </button>
                    )}
                    <button
                      className="adm-accion"
                      title="Ver notas y detalles"
                      onClick={() => setVentaDetalle(v)}
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </button>
                    <button
                      className="adm-accion adm-accion--peligro"
                      title="Eliminar registro"
                      onClick={() => setVentaAEliminar(v)}
                    >
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
          totalPaginas={ventasData?.totalPaginas || 0}
          totalElementos={ventasData?.totalElementos || 0}
          onCambiar={setPagina}
          singular="venta"
          plural="ventas"
        />
      </div>

      {/* ── Modal Nueva Venta ── */}
      {modalNuevaVenta && (
        <ModalNuevaVenta
          onCerrar={() => setModalNuevaVenta(false)}
          onGuardado={() => {
            avisar("Venta registrada exitosamente");
            cargarVentas();
            cargarEstadisticas();
          }}
        />
      )}

      {/* ── Modal Detalle de Venta ── */}
      {ventaDetalle && (
        <Modal
          titulo="Detalle de Venta"
          subtitulo={ventaDetalle.referencia}
          icono="receipt_long"
          onCerrar={() => setVentaDetalle(null)}
          ancho={500}
        >
          <div className="adm-detalle-venta" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="fila-dato">
              <span className="etiqueta-dato">Cliente:</span>
              <span className="valor-dato"><b>{ventaDetalle.clienteNombre}</b> ({ventaDetalle.clienteCorreo})</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Plan:</span>
              <span className="valor-dato">{PLANES[ventaDetalle.plan] || ventaDetalle.plan}</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Monto:</span>
              <span className="valor-dato"><b>{formatoMoneda(ventaDetalle.monto)}</b> COP</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Periodo:</span>
              <span className="valor-dato">{ventaDetalle.periodo}</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Método:</span>
              <span className="valor-dato">{ventaDetalle.metodoPago}</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Estado:</span>
              <span className="valor-dato">{ventaDetalle.estado}</span>
            </div>
            <div className="fila-dato">
              <span className="etiqueta-dato">Fecha:</span>
              <span className="valor-dato">{fecha(ventaDetalle.creadoEn)}</span>
            </div>
            {ventaDetalle.notas && (
              <div style={{ marginTop: "8px", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px" }}>
                <span className="adm-subtexto" style={{ fontWeight: 600 }}>Notas / Observaciones:</span>
                <p style={{ margin: "4px 0 0", color: "var(--adm-texto-2)" }}>{ventaDetalle.notas}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Confirmar Eliminación ── */}
      {ventaAEliminar && (
        <Confirmar
          titulo="Eliminar registro de venta"
          peligro
          icono="delete_forever"
          textoConfirmar="Eliminar"
          mensaje={`¿Seguro que deseas eliminar la venta con referencia ${ventaAEliminar.referencia} de ${ventaAEliminar.clienteNombre}?`}
          onConfirmar={eliminarVentaConfirmada}
          onCerrar={() => setVentaAEliminar(null)}
        />
      )}
    </div>
  );
}

function ModalNuevaVenta({ onCerrar, onGuardado }) {
  const [usuarioElegido, setUsuarioElegido] = useState(null);
  const [plan, setPlan] = useState("PRO");
  const [periodo, setPeriodo] = useState("MENSUAL");
  const [monto, setMonto] = useState(PRECIOS_BASE.PRO.mensual);
  const [metodoPago, setMetodoPago] = useState("WOMPI");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Al cambiar plan o periodo, recalcular monto sugerido
  const cambiarPlan = (nuevoPlan) => {
    setPlan(nuevoPlan);
    const precios = PRECIOS_BASE[nuevoPlan];
    if (precios) {
      setMonto(periodo === "ANUAL" ? precios.anual : precios.mensual);
    }
  };

  const cambiarPeriodo = (nuevoPeriodo) => {
    setPeriodo(nuevoPeriodo);
    const precios = PRECIOS_BASE[plan];
    if (precios) {
      setMonto(nuevoPeriodo === "ANUAL" ? precios.anual : precios.mensual);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!usuarioElegido) {
      setError("Debes seleccionar un cliente registrado de la plataforma.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const nombreCliente = `${usuarioElegido.nombre || ""} ${usuarioElegido.apellido || ""}`.trim() || usuarioElegido.usuario;
      await post("/admin/ventas", {
        usuarioId: usuarioElegido.id,
        clienteNombre: nombreCliente,
        clienteCorreo: usuarioElegido.correo || "",
        plan,
        periodo,
        monto: Number(monto),
        metodoPago,
        estado: "APROBADO",
        notas,
      });
      onGuardado();
      onCerrar();
    } catch (err) {
      setError(err.message || "Error al registrar la venta");
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Registrar nueva venta"
      subtitulo="Asigna un plan y registra el comprobante a un cliente de la plataforma"
      icono="add_card"
      onCerrar={onCerrar}
      ancho={560}
      pie={
        <>
          <button type="button" className="adm-btn-fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="submit"
            form="form-nueva-venta"
            className="adm-btn-primario"
            disabled={enviando}
          >
            {enviando ? "Registrando…" : "Registrar venta"}
          </button>
        </>
      }
    >
      <form id="form-nueva-venta" className="adm-form" onSubmit={guardar}>
        {error && (
          <div className="adm-error adm-error--sm">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        <div className="adm-campo adm-campo--ancho">
          <label className="adm-campo-etiqueta">Seleccionar cliente registrado *</label>
          <SelectorUsuario
            valor={usuarioElegido}
            onCambiar={setUsuarioElegido}
            permitirNinguno={false}
          />
        </div>

        {usuarioElegido && (
          <div className="adm-campo adm-campo--ancho" style={{ background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: "8px", border: "1px solid var(--adm-borde)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="adm-subtexto">Plan actual en cuenta:</span>
              <span className="adm-insignia adm-insignia--gris">{PLANES[usuarioElegido.plan] || usuarioElegido.plan || "PERSONAL"}</span>
            </div>
            <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--adm-texto-3)" }}>
              Al aprobar esta venta, el plan del usuario se actualizará a <b>{PLANES[plan] || plan}</b> automáticamente.
            </div>
          </div>
        )}

        <div className="adm-campo adm-campo--ancho">
          <label className="adm-campo-etiqueta">Plan comercial *</label>
          <Segmentos
            opciones={[
              { valor: "PERSONAL", etiqueta: "Personal ($24.900)" },
              { valor: "PRO", etiqueta: "Pro ($44.900)" },
              { valor: "ENTERPRISE", etiqueta: "Enterprise ($79.900)" },
            ]}
            valor={plan}
            onCambiar={cambiarPlan}
          />
        </div>

        <div className="adm-campo">
          <label className="adm-campo-etiqueta">Periodicidad</label>
          <Segmentos
            opciones={[
              { valor: "MENSUAL", etiqueta: "Mensual" },
              { valor: "ANUAL", etiqueta: "Anual (-20%)" },
            ]}
            valor={periodo}
            onCambiar={cambiarPeriodo}
          />
        </div>

        <div className="adm-campo">
          <label className="adm-campo-etiqueta">Monto pagado (COP) *</label>
          <input
            className="adm-entrada"
            type="number"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            required
            min="1000"
          />
        </div>

        <div className="adm-campo">
          <label className="adm-campo-etiqueta">Método de pago</label>
          <select
            className="adm-entrada"
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value)}
          >
            <option value="WOMPI">Wompi (Pasarela)</option>
            <option value="NEQUI">Nequi</option>
            <option value="PSE">PSE</option>
            <option value="TARJETA">Tarjeta Débito/Crédito</option>
            <option value="TRANSFERENCIA">Transferencia Bancaria</option>
            <option value="EFECTIVO">Efectivo / Manual</option>
          </select>
        </div>

        <div className="adm-campo adm-campo--ancho">
          <label className="adm-campo-etiqueta">Notas / Observaciones</label>
          <textarea
            className="adm-entrada"
            rows={2}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Detalles de la transacción o comprobante de pago..."
          />
        </div>
      </form>
    </Modal>
  );
}
