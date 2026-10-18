import { useState } from "react";
import { patch, post, put } from "../../Service/api";
import { Campo, Modal, Segmentos, SelectorUsuario } from "./AdminUI";
import { ROLES, errorDeFormulario, nombreCompleto, olvidarPropietario } from "./adminUtils";

const OPCIONES_ROL = [
  { valor: "ADMINISTRADOR", etiqueta: "Administrador" },
  { valor: "USUARIO", etiqueta: "Cliente" },
  { valor: "VIEWER", etiqueta: "Solo lectura" },
];

const OPCIONES_PLAN = [
  { valor: "PERSONAL", etiqueta: "Personal ($24.900)" },
  { valor: "PRO", etiqueta: "Pro ($44.900)" },
  { valor: "ENTERPRISE", etiqueta: "Enterprise ($79.900)" },
];

function Pie({ onCerrar, enviando, texto, formulario }) {
  return (
    <>
      <button type="button" className="adm-btn-fantasma" onClick={onCerrar}>Cancelar</button>
      <button type="submit" form={formulario} className="adm-btn-primario" disabled={enviando}>
        {enviando ? "Guardando…" : texto}
      </button>
    </>
  );
}

function AvisoError({ error }) {
  if (!error) return null;
  return <div className="adm-error adm-error--sm"><span className="material-symbols-outlined">error</span>{error}</div>;
}

/* ── Usuario: alta y edición ─────────────────────────────────── */

export function FormUsuario({ usuario, onCerrar, onGuardado }) {
  const editando = Boolean(usuario);
  const [datos, setDatos] = useState({
    nombre: usuario?.nombre || "",
    apellido: usuario?.apellido || "",
    usuario: usuario?.usuario || "",
    correo: usuario?.correo || "",
    telefono: usuario?.telefono || "",
    rol: usuario?.rol || "USUARIO",
    plan: usuario?.plan || "PERSONAL",
    contrasena: "",
    activo: usuario?.activo ?? true,
  });
  const [errores, setErrores] = useState({ general: null, campos: {} });
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({ general: null, campos: {} });
    try {
      let resultado;
      if (editando) {
        const { nombre, apellido, usuario: nombreUsuario, correo, telefono, plan } = datos;
        resultado = await put(`/admin/usuarios/${usuario.id}`, { nombre, apellido, usuario: nombreUsuario, correo, telefono, plan });
        if (datos.rol !== usuario.rol) {
          resultado = await patch(`/admin/usuarios/${usuario.id}/rol`, { rol: datos.rol });
        }
        if (datos.plan !== usuario.plan) {
          resultado = await patch(`/admin/usuarios/${usuario.id}/plan`, { plan: datos.plan });
        }
        olvidarPropietario(usuario.id);
      } else {
        resultado = await post("/admin/usuarios", datos);
      }
      onGuardado(resultado, editando ? "Usuario actualizado" : "Usuario creado");
      onCerrar();
    } catch (err) {
      setErrores(errorDeFormulario(err));
      setEnviando(false);
    }
  };

  const c = errores.campos;
  return (
    <Modal
      titulo={editando ? "Editar usuario" : "Nuevo usuario"}
      subtitulo={editando ? `@${usuario.usuario}` : "Alta con rol y acceso al sistema"}
      icono={editando ? "manage_accounts" : "person_add"}
      onCerrar={onCerrar}
      ancho={600}
      pie={<Pie onCerrar={onCerrar} enviando={enviando} texto={editando ? "Guardar cambios" : "Crear usuario"} formulario="form-usuario" />}
    >
      <form id="form-usuario" className="adm-form" onSubmit={guardar} noValidate>
        <AvisoError error={errores.general} />
        <Campo etiqueta="Nombre" error={c.nombre}>
          <input className="adm-entrada" value={datos.nombre} onChange={cambiar("nombre")} required maxLength={60} autoFocus />
        </Campo>
        <Campo etiqueta="Apellido" error={c.apellido}>
          <input className="adm-entrada" value={datos.apellido} onChange={cambiar("apellido")} maxLength={60} />
        </Campo>
        <Campo etiqueta="Nombre de usuario" error={c.usuario}>
          <input className="adm-entrada" value={datos.usuario} onChange={cambiar("usuario")} required minLength={3} maxLength={30} autoComplete="off" />
        </Campo>
        <Campo etiqueta="Teléfono" error={c.telefono}>
          <input className="adm-entrada" value={datos.telefono} onChange={cambiar("telefono")} inputMode="tel" />
        </Campo>
        <Campo etiqueta="Correo electrónico" error={c.correo} ancho>
          <input className="adm-entrada" type="email" value={datos.correo} onChange={cambiar("correo")} required maxLength={120} />
        </Campo>
        {!editando && (
          <Campo etiqueta="Contraseña inicial" error={c.contrasena} ayuda="Entre 8 y 72 caracteres. El usuario podrá cambiarla." ancho>
            <input className="adm-entrada" type="password" value={datos.contrasena} onChange={cambiar("contrasena")} required minLength={8} maxLength={72} autoComplete="new-password" />
          </Campo>
        )}
        <Campo etiqueta="Rol" error={c.rol} ancho>
          <Segmentos opciones={OPCIONES_ROL} valor={datos.rol} onCambiar={(rol) => setDatos((d) => ({ ...d, rol }))} />
        </Campo>
        <Campo etiqueta="Plan comercial" error={c.plan} ancho>
          <Segmentos opciones={OPCIONES_PLAN} valor={datos.plan} onCambiar={(plan) => setDatos((d) => ({ ...d, plan }))} />
        </Campo>
        {!editando && (
          <label className="adm-interruptor adm-campo--ancho">
            <input type="checkbox" checked={datos.activo} onChange={(e) => setDatos((d) => ({ ...d, activo: e.target.checked }))} />
            <span className="adm-interruptor-pista" />
            Cuenta activa desde el primer momento
          </label>
        )}
      </form>
    </Modal>
  );
}

/* ── Usuario: restablecer contraseña ─────────────────────────── */

export function FormContrasena({ usuario, onCerrar, onGuardado }) {
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    if (nueva.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (nueva !== repetir) return setError("Las contraseñas no coinciden");
    setEnviando(true);
    setError(null);
    try {
      await patch(`/admin/usuarios/${usuario.id}/contrasena`, { nuevaContrasena: nueva });
      onGuardado(null, `Contraseña de @${usuario.usuario} restablecida`);
      onCerrar();
    } catch (err) {
      setError(err.campos?.nuevaContrasena || err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Restablecer contraseña"
      subtitulo={`${nombreCompleto(usuario)} · @${usuario.usuario}`}
      icono="key"
      onCerrar={onCerrar}
      ancho={460}
      pie={<Pie onCerrar={onCerrar} enviando={enviando} texto="Restablecer" formulario="form-contrasena" />}
    >
      <form id="form-contrasena" className="adm-form adm-form--una" onSubmit={guardar} noValidate>
        <p className="adm-modal-texto">Se cerrarán todas las sesiones abiertas de este usuario.</p>
        <AvisoError error={error} />
        <Campo etiqueta="Nueva contraseña">
          <input className="adm-entrada" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" autoFocus />
        </Campo>
        <Campo etiqueta="Repite la contraseña">
          <input className="adm-entrada" type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </Campo>
      </form>
    </Modal>
  );
}

/* ── Vehículo: alta y edición ────────────────────────────────── */

export function FormVehiculo({ vehiculo, onCerrar, onGuardado }) {
  const editando = Boolean(vehiculo);
  const [datos, setDatos] = useState({
    placa: vehiculo?.placa || "",
    imei: vehiculo?.imei || "",
    modelo: vehiculo?.modelo || "",
    tipo: vehiculo?.tipo || "MOTO",
    activo: vehiculo?.activo ?? true,
  });
  const [propietario, setPropietario] = useState(null);
  const [errores, setErrores] = useState({ general: null, campos: {} });
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo, transformar = (v) => v) => (e) =>
    setDatos((d) => ({ ...d, [campo]: transformar(e.target.value) }));

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrores({ general: null, campos: {} });
    try {
      const cuerpo = { placa: datos.placa.trim(), imei: datos.imei.trim(), modelo: datos.modelo, tipo: datos.tipo };
      const resultado = editando
        ? await put(`/vehiculo/${vehiculo.id}`, cuerpo)
        : await post("/vehiculo", { ...cuerpo, activo: datos.activo, id_usuario: propietario?.id || null });
      onGuardado(resultado, editando ? "Vehículo actualizado" : `Equipo ${resultado.placa} registrado`);
      onCerrar();
    } catch (err) {
      setErrores(errorDeFormulario(err));
      setEnviando(false);
    }
  };

  const c = errores.campos;
  return (
    <Modal
      titulo={editando ? "Editar vehículo" : "Registrar equipo"}
      subtitulo={editando ? vehiculo.placa : "Vehículo con su equipo GPS GT06"}
      icono={editando ? "edit" : "add_location_alt"}
      onCerrar={onCerrar}
      ancho={600}
      pie={<Pie onCerrar={onCerrar} enviando={enviando} texto={editando ? "Guardar cambios" : "Registrar"} formulario="form-vehiculo" />}
    >
      <form id="form-vehiculo" className="adm-form" onSubmit={guardar} noValidate>
        <AvisoError error={errores.general} />
        <Campo etiqueta="Placa" error={c.placa} ayuda="5 o 6 caracteres">
          <input className="adm-entrada adm-entrada--placa" value={datos.placa} onChange={cambiar("placa", (v) => v.toUpperCase())} required minLength={5} maxLength={6} autoFocus />
        </Campo>
        <Campo etiqueta="Modelo" error={c.modelo}>
          <input className="adm-entrada" value={datos.modelo} onChange={cambiar("modelo")} required maxLength={60} placeholder="Ej. Pulsar NS 200" />
        </Campo>
        <Campo etiqueta="IMEI del equipo GPS" error={c.imei} ayuda="15 o 16 dígitos. Déjalo vacío si aún no tiene equipo." ancho>
          <input className="adm-entrada adm-entrada--mono" value={datos.imei} onChange={cambiar("imei", (v) => v.replace(/\D/g, ""))} inputMode="numeric" maxLength={16} />
        </Campo>
        <Campo etiqueta="Tipo" error={c.tipo} ancho>
          <Segmentos
            opciones={[{ valor: "MOTO", etiqueta: "Moto", icono: "two_wheeler" }, { valor: "CARRO", etiqueta: "Carro", icono: "directions_car" }]}
            valor={datos.tipo}
            onCambiar={(tipo) => setDatos((d) => ({ ...d, tipo }))}
          />
        </Campo>
        {!editando && (
          <>
            <Campo etiqueta="Propietario" error={c.id_usuario} ancho>
              <SelectorUsuario valor={propietario} onCambiar={setPropietario} />
            </Campo>
            <label className="adm-interruptor adm-campo--ancho">
              <input type="checkbox" checked={datos.activo} onChange={(e) => setDatos((d) => ({ ...d, activo: e.target.checked }))} />
              <span className="adm-interruptor-pista" />
              Activar el rastreo al registrarlo
            </label>
          </>
        )}
      </form>
    </Modal>
  );
}

/* ── Vehículo: vincular propietario ──────────────────────────── */

export function FormVincular({ vehiculo, propietarioActual, onCerrar, onGuardado }) {
  const [elegido, setElegido] = useState(propietarioActual || null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const guardar = async (idUsuario) => {
    setEnviando(true);
    setError(null);
    try {
      const resultado = await put(`/admin/vehiculos/${vehiculo.id}/usuario`, { id_usuario: idUsuario });
      onGuardado(resultado, idUsuario ? `${vehiculo.placa} vinculado a ${nombreCompleto(elegido)}` : `${vehiculo.placa} quedó sin propietario`);
      onCerrar();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Vincular vehículo y usuario"
      subtitulo={`${vehiculo.placa} · ${vehiculo.modelo}`}
      icono="link"
      onCerrar={onCerrar}
      ancho={520}
      pie={(
        <>
          {vehiculo.id_usuario && (
            <button type="button" className="adm-btn-fantasma adm-btn-fantasma--peligro" disabled={enviando} onClick={() => guardar(null)}>
              Quitar propietario
            </button>
          )}
          <span className="adm-espaciador" />
          <button type="button" className="adm-btn-fantasma" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="adm-btn-primario" disabled={enviando || !elegido || elegido.id === vehiculo.id_usuario} onClick={() => guardar(elegido.id)}>
            {enviando ? "Guardando…" : "Vincular"}
          </button>
        </>
      )}
    >
      <div className="adm-form adm-form--una">
        <AvisoError error={error} />
        <Campo etiqueta="Propietario">
          <SelectorUsuario valor={elegido} onCambiar={setElegido} permitirNinguno={false} />
        </Campo>
      </div>
    </Modal>
  );
}
