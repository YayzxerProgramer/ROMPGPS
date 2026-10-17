import { useCallback, useEffect, useState } from "react";
import { del, get, patch } from "../../Service/api";
import { obtenerUsuario } from "../../Service/sesion";
import { Confirmar, InsigniaEstado, Modal, Paginacion, Segmentos, Vacio } from "./AdminUI";
import { useAvisar } from "./avisos";
import { FormContrasena, FormUsuario } from "./AdminFormularios";
import { PLANES, ROLES, contar, fecha, iniciales, nombreCompleto, olvidarPropietario, query } from "./adminUtils";

const FILTRO_ROL = [
  { valor: "", etiqueta: "Todos" },
  { valor: "ADMINISTRADOR", etiqueta: "Admin" },
  { valor: "USUARIO", etiqueta: "Clientes" },
  { valor: "VIEWER", etiqueta: "Lectura" },
];

const FILTRO_ESTADO = [
  { valor: "", etiqueta: "Todos" },
  { valor: "true", etiqueta: "Activos" },
  { valor: "false", etiqueta: "Inactivos" },
];

const TAMANO = 15;

export default function AdminClientes({ busqueda, abrirAlta, onAltaAbierta, onCambio }) {
  const avisar = useAvisar();
  const yo = obtenerUsuario();

  const [rol, setRol] = useState("");
  const [activo, setActivo] = useState("");
  // La página va ligada a los filtros: al cambiar cualquiera vuelve a la 0.
  const filtros = `${busqueda}|${rol}|${activo}`;
  const [paginaDe, setPaginaDe] = useState({ filtros, n: 0 });
  const pagina = paginaDe.filtros === filtros ? paginaDe.n : 0;
  const setPagina = (n) => setPaginaDe({ filtros, n });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // "Registro de clientes" desde el resumen llega con el alta ya abierta.
  const [dialogo, setDialogo] = useState(() => (abrirAlta ? { tipo: "crear" } : null));

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await get(`/admin/usuarios${query({ busqueda, rol, activo, pagina, tamano: TAMANO })}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [busqueda, rol, activo, pagina]);

  useEffect(() => {
    const id = setTimeout(cargar, 250);
    return () => clearTimeout(id);
  }, [cargar]);

  useEffect(() => {
    if (abrirAlta) onAltaAbierta();
  }, [abrirAlta, onAltaAbierta]);

  const tras = (_, mensaje) => {
    avisar(mensaje);
    cargar();
    onCambio();
  };

  const alternarEstado = async (u) => {
    try {
      await patch(`/admin/usuarios/${u.id}/estado`);
      olvidarPropietario(u.id);
      avisar(u.activo ? `@${u.usuario} desactivado` : `@${u.usuario} activado`);
      cargar();
      onCambio();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const usuarios = datos?.contenido || [];

  return (
    <div className="adm-seccion">
      <div className="adm-encabezado">
        <div>
          <div className="adm-encabezado-meta">
            <span className="adm-en-vivo"><span className="material-symbols-outlined">group</span>CLIENTES</span>
            {datos && <span className="adm-encabezado-nota">{contar(datos.totalElementos, "cuenta")}</span>}
          </div>
          <h1 className="adm-titulo">Registro de <em>clientes</em></h1>
          <p className="adm-subtitulo">Altas, roles y acceso de los usuarios del sistema.</p>
        </div>
        <button className="adm-btn-primario" onClick={() => setDialogo({ tipo: "crear" })}>
          <span className="material-symbols-outlined">person_add</span>Nuevo usuario
        </button>
      </div>

      <div className="adm-filtros">
        <div className="adm-filtro">
          <span className="adm-etiqueta">ROL</span>
          <Segmentos opciones={FILTRO_ROL} valor={rol} onCambiar={setRol} pequeno />
        </div>
        <div className="adm-filtro">
          <span className="adm-etiqueta">ESTADO</span>
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
          <div className="adm-tabla adm-tabla--usuarios">
            <div className="adm-tabla-fila adm-tabla-fila--cab">
              <span>USUARIO</span><span>CONTACTO</span><span>ROL</span><span>PLAN</span><span>ESTADO</span><span>ALTA</span><span className="der">ACCIONES</span>
            </div>

            {cargando && usuarios.length === 0 && <div className="adm-tabla-vacia">Cargando usuarios…</div>}
            {!cargando && !error && usuarios.length === 0 && (
              <Vacio icono="person_off" titulo="Sin usuarios" texto={busqueda ? "Nadie coincide con la búsqueda." : "Ajusta los filtros para ver resultados."} />
            )}

            {usuarios.map((u) => {
              const soyYo = u.usuario === yo;
              const planClase =
                u.plan === "ENTERPRISE"
                  ? "adm-insignia--dorado"
                  : u.plan === "PRO"
                  ? "adm-insignia--verde"
                  : "adm-insignia--gris";
              return (
                <div key={u.id} className="adm-tabla-fila" onClick={() => setDialogo({ tipo: "ficha", usuario: u })}>
                  <div className="adm-propietario">
                    <span className={`adm-iniciales ${u.rol === "ADMINISTRADOR" || u.rol === "ADMIN" ? "adm-iniciales--admin" : ""}`}>{iniciales(nombreCompleto(u))}</span>
                    <span className="adm-celda-doble">
                      <b>{nombreCompleto(u)}{soyYo && <span className="adm-tu">TÚ</span>}</b>
                      <span>@{u.usuario}</span>
                    </span>
                  </div>
                  <div className="adm-celda-doble">
                    <span className="adm-celda-texto">{u.correo}</span>
                    <span className="adm-celda-mono">{u.telefono || "—"}</span>
                  </div>
                  <div><span className={`adm-rol adm-rol--${u.rol}`}>{ROLES[u.rol] || u.rol}</span></div>
                  <div><span className={`adm-insignia ${planClase}`}>{PLANES[u.plan] || u.plan || "Personal"}</span></div>
                  <div><InsigniaEstado estado={u.activo ? "marcha" : "off"} texto={u.activo ? "ACTIVO" : "INACTIVO"} /></div>
                  <div className="adm-alta">{fecha(u.creadoEn)}</div>
                  <div className="der adm-acciones" onClick={(e) => e.stopPropagation()}>
                    <button className="adm-accion" title="Editar" onClick={() => setDialogo({ tipo: "editar", usuario: u })}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button className="adm-accion" title="Restablecer contraseña" onClick={() => setDialogo({ tipo: "clave", usuario: u })}>
                      <span className="material-symbols-outlined">key</span>
                    </button>
                    <button
                      className="adm-accion"
                      title={soyYo ? "No puedes desactivar tu propia cuenta" : u.activo ? "Desactivar" : "Activar"}
                      disabled={soyYo}
                      onClick={() => alternarEstado(u)}
                    >
                      <span className="material-symbols-outlined">{u.activo ? "toggle_on" : "toggle_off"}</span>
                    </button>
                    <button
                      className="adm-accion adm-accion--peligro"
                      title={soyYo ? "No puedes eliminar tu propia cuenta" : "Eliminar"}
                      disabled={soyYo}
                      onClick={() => setDialogo({ tipo: "eliminar", usuario: u })}
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
          totalPaginas={datos?.totalPaginas || 0}
          totalElementos={datos?.totalElementos || 0}
          onCambiar={setPagina}
          singular="usuario"
        />
      </div>

      {dialogo?.tipo === "crear" && <FormUsuario onCerrar={() => setDialogo(null)} onGuardado={tras} />}
      {dialogo?.tipo === "editar" && <FormUsuario usuario={dialogo.usuario} onCerrar={() => setDialogo(null)} onGuardado={tras} />}
      {dialogo?.tipo === "clave" && <FormContrasena usuario={dialogo.usuario} onCerrar={() => setDialogo(null)} onGuardado={tras} />}
      {dialogo?.tipo === "eliminar" && (
        <Confirmar
          titulo="Eliminar usuario"
          peligro
          icono="person_remove"
          textoConfirmar="Eliminar"
          mensaje={`Se eliminará la cuenta de ${nombreCompleto(dialogo.usuario)} (@${dialogo.usuario.usuario}). Esta acción no se puede deshacer.`}
          onConfirmar={async () => {
            await del(`/admin/usuarios/${dialogo.usuario.id}`);
            olvidarPropietario(dialogo.usuario.id);
            tras(null, "Usuario eliminado");
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === "ficha" && (
        <FichaUsuario
          usuario={dialogo.usuario}
          onCerrar={() => setDialogo(null)}
          onEditar={() => setDialogo({ tipo: "editar", usuario: dialogo.usuario })}
        />
      )}
    </div>
  );
}

function FichaUsuario({ usuario, onCerrar, onEditar }) {
  const [vehiculos, setVehiculos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    get(`/admin/usuarios/${usuario.id}/vehiculos`).then(setVehiculos).catch((e) => setError(e.message));
  }, [usuario.id]);

  return (
    <Modal
      titulo={nombreCompleto(usuario)}
      subtitulo={`@${usuario.usuario} · ${ROLES[usuario.rol] || usuario.rol}`}
      icono="badge"
      onCerrar={onCerrar}
      ancho={560}
      pie={(
        <>
          <button type="button" className="adm-btn-fantasma" onClick={onCerrar}>Cerrar</button>
          <button type="button" className="adm-btn-primario" onClick={onEditar}>
            <span className="material-symbols-outlined">edit</span>Editar
          </button>
        </>
      )}
    >
      <div className="adm-ficha-rejilla">
        <div><span className="adm-etiqueta">CORREO</span><b>{usuario.correo}</b></div>
        <div><span className="adm-etiqueta">TELÉFONO</span><b>{usuario.telefono || "—"}</b></div>
        <div><span className="adm-etiqueta">PLAN</span><b>{PLANES[usuario.plan] || usuario.plan || "Personal"}</b></div>
        <div><span className="adm-etiqueta">ESTADO</span><InsigniaEstado estado={usuario.activo ? "marcha" : "off"} texto={usuario.activo ? "ACTIVO" : "INACTIVO"} /></div>
        <div><span className="adm-etiqueta">ALTA</span><b>{fecha(usuario.creadoEn)}</b></div>
      </div>

      <div className="adm-etiqueta adm-ficha-separador">VEHÍCULOS ({vehiculos?.length ?? "…"})</div>
      {error && <div className="adm-error adm-error--sm"><span className="material-symbols-outlined">error</span>{error}</div>}
      {vehiculos && vehiculos.length === 0 && <p className="adm-modal-texto">Este usuario no tiene vehículos asignados.</p>}
      <div className="adm-lista-mini">
        {(vehiculos || []).map((v) => (
          <div key={v.id} className="adm-lista-mini-item">
            <span className="material-symbols-outlined">{v.tipo === "CARRO" ? "directions_car" : "two_wheeler"}</span>
            <span className="adm-celda-doble">
              <b>{v.placa}</b>
              <span>{v.modelo} · {v.imei || "sin GPS"}</span>
            </span>
            <InsigniaEstado estado={v.activo ? "marcha" : "off"} texto={v.activo ? "ACTIVO" : "INACTIVO"} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
