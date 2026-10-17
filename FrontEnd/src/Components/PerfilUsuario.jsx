import { useEffect, useRef, useState } from "react";
import "../Styles/PerfilUsuario.css";
import PanelVehiculo from "../Components/PanelVehiculo";
import FondoAurora from "./FondoAurora";
import { useNavigate } from "react-router-dom";
import { cerrarSesion, esAdmin } from "../Service/sesion";
import { API_URL } from "../Service/api";

const ENLACES_NAV = [
    { icono: "person", etiqueta: "Perfil" },
    { icono: "directions_car", etiqueta: "Vehículos" },
];

const ENLACES_PIE_NAV = [
    { icono: "logout", etiqueta: "Cerrar Sesión", onClick: () => { cerrarSesion(); window.location.href = "/login"; } },
];

function NavegacionLateral({ enlaceActivo, setEnlaceActivo }) {
    const navigate = useNavigate();
    const [abierta, setAbierta] = useState(false);

    // Escape cierra el menú y el fondo no se desplaza mientras está abierto
    useEffect(() => {
        if (!abierta) return;

        const alPulsarTecla = (e) => {
            if (e.key === "Escape") setAbierta(false);
        };

        document.body.classList.add("sin-scroll");
        window.addEventListener("keydown", alPulsarTecla);

        return () => {
            document.body.classList.remove("sin-scroll");
            window.removeEventListener("keydown", alPulsarTecla);
        };
    }, [abierta]);

    const seleccionar = (etiqueta) => {
        setEnlaceActivo(etiqueta);
        setAbierta(false);
    };

    return (
        <>
            <button
                type="button"
                className="boton-menu-perfil"
                aria-label={abierta ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={abierta}
                aria-controls="navegacion-lateral-perfil"
                onClick={() => setAbierta((v) => !v)}
            >
                <span className="material-symbols-outlined">
                    {abierta ? "close" : "menu"}
                </span>
            </button>

            <div
                className={`velo-perfil ${abierta ? "velo-perfil--visible" : ""}`}
                onClick={() => setAbierta(false)}
                aria-hidden="true"
            />

            <aside
                id="navegacion-lateral-perfil"
                className={`navegacion-lateral ${abierta ? "navegacion-lateral--abierta" : ""}`}
            >
                <div className="bloque-usuario">
                    <div className="contenedor-avatar-mini">
                        <span className="material-symbols-outlined">person</span>
                    </div>
                    <div>
                        <p className="nombre-usuario-mini">ROMP GPS</p>
                        <p className="unidades-usuario">Precision Navigation Core</p>
                    </div>
                </div>

                <nav className="menu-lateral">
                    {ENLACES_NAV.map(({ icono, etiqueta }) => (
                        <a
                            key={etiqueta}
                            href="#"
                            className={`enlace-lateral ${enlaceActivo === etiqueta ? "enlace-lateral--activo" : ""}`}
                            onClick={(e) => { e.preventDefault(); seleccionar(etiqueta); }}
                        >
                            <span className="material-symbols-outlined">{icono}</span>
                            {etiqueta}
                        </a>
                    ))}
                </nav>

                <div className="pie-nav-lateral">
                    {/* Un administrador que llega aquí puede volver a su panel. */}
                    {esAdmin() && (
                        <a href="/admin" className="enlace-lateral" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}>
                            <span className="material-symbols-outlined">shield_person</span>
                            Panel de administración
                        </a>
                    )}

                    {/* Vuelta al panel de control, justo encima de Cerrar Sesión.
                        Es un enlace real (href): también se abre en otra pestaña. */}
                    <a
                        href="/panel-control"
                        className="enlace-lateral"
                        onClick={(e) => {
                            e.preventDefault();
                            setAbierta(false);
                            navigate("/panel-control");
                        }}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Volver al panel
                    </a>

                    {ENLACES_PIE_NAV.map(({ icono, etiqueta, onClick }) => (
                        <a key={etiqueta} href="#" className="enlace-lateral" onClick={onClick}>
                            <span className="material-symbols-outlined">{icono}</span>
                            {etiqueta}
                        </a>
                    ))}
                </div>
            </aside>
        </>
    );
}

function TarjetaIdentidad({ usuarioData, onSubirFoto, subiendoFoto }) {
    const fileInputRef = useRef(null);

    return (
        <div className="tarjeta-identidad panel-vidrio">
            {/* Input oculto para seleccionar foto de perfil */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={onSubirFoto}
            />

            <div className="qr-decorativo" aria-hidden="true">
                <span className="material-symbols-outlined">qr_code_2</span>
            </div>
            <div className="contenedor-avatar-perfil">
                <div className="anillo-avatar">
                    {usuarioData?.imagenUrl ? (
                        <img className="avatar-perfil-user" src={usuarioData.imagenUrl} alt="Foto de perfil" />
                    ) : (
                        <div className="avatar-placeholder">
                            {usuarioData?.usuario?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="boton-camara"
                    aria-label="Cambiar foto de perfil"
                    disabled={subiendoFoto}
                    onClick={() => fileInputRef.current?.click()}
                    title={subiendoFoto ? "Subiendo foto..." : "Cambiar foto de perfil"}
                >
                    <span
                        className={`material-symbols-outlined ${subiendoFoto ? "icono-giratorio" : ""}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        {subiendoFoto ? "sync" : "photo_camera"}
                    </span>
                </button>
            </div>
            <h3 className="nombre-perfil">{usuarioData?.usuario || "Usuario"}</h3>
            <p className="rol-perfil">{usuarioData?.rol || "USUARIO"}</p>
            <div className="datos-identidad">
                <div className="fila-dato">
                    <span className="etiqueta-dato">Plan Activo</span>
                    <span className="insignia-plan" style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: usuarioData?.plan === "ENTERPRISE" ? "rgba(224, 185, 122, 0.2)" : usuarioData?.plan === "PRO" ? "rgba(178, 206, 168, 0.2)" : "rgba(255, 255, 255, 0.08)",
                        color: usuarioData?.plan === "ENTERPRISE" ? "#e0b97a" : usuarioData?.plan === "PRO" ? "#b2cea8" : "inherit"
                    }}>
                        {usuarioData?.plan === "ENTERPRISE" ? "Empresarial Custom" : usuarioData?.plan === "PRO" ? "Flotas & Negocios Pro" : "Personal (Moto / Auto)"}
                    </span>
                </div>
                <div className="fila-dato">
                    <span className="etiqueta-dato">Estado</span>
                    <span className="insignia-activo">{usuarioData?.activo ? "Activo" : "Inactivo"}</span>
                </div>
                <div className="fila-dato">
                    <span className="etiqueta-dato">Correo</span>
                    <span className="valor-dato">{usuarioData?.correo || "No disponible"}</span>
                </div>
            </div>
        </div>
    );
}

function CampoFormulario({ etiqueta, tipo = "text", valor, onChange, prefijo, style }) {
    const [enfocado, setEnfocado] = useState(false);
    return (
        <div className="grupo-campo-perfil" style={style}>
            <label className={`etiqueta-campo-perfil ${enfocado ? "etiqueta-campo-perfil--activa" : ""}`}>
                {etiqueta}
            </label>
            <div className="envoltorio-campo">
                {prefijo && <span className="prefijo-campo">{prefijo}</span>}
                <input
                    className={`campo-perfil ${prefijo ? "campo-perfil--con-prefijo" : ""}`}
                    type={tipo}
                    value={valor}
                    onChange={onChange}
                    onFocus={() => setEnfocado(true)}
                    onBlur={() => setEnfocado(false)}
                />
            </div>
        </div>
    );
}

function ModalGuardar({ modalGuardar, setModalGuardar, actualizarUsuario }) {
    if (!modalGuardar) return null;
    return (
        <div className="modal-overlay" onClick={() => setModalGuardar(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-titulo">Confirmar cambios</div>
                <p className="modal-desc">¿Deseas guardar los cambios realizados en tu perfil?</p>
                <div className="modal-acciones">
                    <button className="modal-btn-cancelar" onClick={() => setModalGuardar(false)}>Cancelar</button>
                    <button className="modal-btn-guardar" onClick={actualizarUsuario}>Guardar</button>
                </div>
            </div>
        </div>
    );
}

function SeccionFormulario({ usuarioData, setUsuarioData, tipo, setTipo, nuevaContrasena, setNuevaContrasena, setModalGuardar }) {
    const navigate = useNavigate();
    return (
        <div className="seccion-formulario">
            <div className="panel-vidrio panel-formulario">
                <div className="cuadricula-campos">
                    <CampoFormulario etiqueta="Nombre" valor={usuarioData?.nombre || ""}
                        onChange={(e) => setUsuarioData((prev) => ({ ...prev, nombre: e.target.value }))} />
                    <CampoFormulario etiqueta="Apellido" valor={usuarioData?.apellido || ""}
                        onChange={(e) => setUsuarioData((prev) => ({ ...prev, apellido: e.target.value }))} />
                    <CampoFormulario etiqueta="Nombre de Usuario" valor={usuarioData?.usuario || ""} prefijo="@"
                        onChange={(e) => setUsuarioData((prev) => ({ ...prev, usuario: e.target.value }))} />
                    <CampoFormulario etiqueta="Teléfono" valor={usuarioData?.telefono || ""}
                        onChange={(e) => setUsuarioData((prev) => ({ ...prev, telefono: e.target.value }))} />
                    <CampoFormulario etiqueta="Correo Electrónico" tipo="email" valor={usuarioData?.correo || ""}
                        onChange={(e) => setUsuarioData((prev) => ({ ...prev, correo: e.target.value }))}
                        style={{ gridColumn: "span 2" }} />
                </div>
                <div className="barra-acciones">
                    <button
                        className="boton-contrasena"
                        type="button"
                        onClick={() => navigate("/cambiar-contrasena")}
                    >
                        <span className="material-symbols-outlined">
                            lock_reset
                        </span>

                        Cambiar Contraseña
                    </button>
                    <div className="grupo-botones-accion">
                        <button className="boton-guardar" onClick={() => setModalGuardar(true)}>
                            Guardar Cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ContenidoPrincipal(props) {
    const { usuarioData, setUsuarioData, setModalGuardar, onSubirFoto, subiendoFoto } = props;
    return (
        <main className="contenido-principal">
            <div className="contenedor-interior">
                <div className="encabezado-telemetria-usuario">
                    <div className="bloque-titulo">
                        <span className="etiqueta-sistema">Sistema // Configuración de perfil</span>
                        <h1 className="titulo-pagina">Configuración de Perfil</h1>
                    </div>
                    <div className="bloque-fecha">
                        <p className="etiqueta-fecha">Estado</p>
                        <p className="valor-fecha">En linea</p>
                    </div>
                </div>
                <div className="cuadricula-contenido">
                    <TarjetaIdentidad
                        usuarioData={usuarioData}
                        onSubirFoto={onSubirFoto}
                        subiendoFoto={subiendoFoto}
                    />
                    <SeccionFormulario
                        usuarioData={usuarioData} setUsuarioData={setUsuarioData}
                        setModalGuardar={setModalGuardar}
                    />
                </div>
            </div>
        </main>
    );
}

function PiePagina() {
    return (
        <footer className="pie-pagina">
            <div className="marca-pie">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                ROMP GPS
            </div>
            <div className="enlaces-pie">
                {["Privacy Policy", "Terms of Service", "API Docs"].map((item) => (
                    <a key={item} className="enlace-pie" href="#">{item}</a>
                ))}
            </div>
            <p className="copyright-pie">© 2024 ROMP GPS.</p>
        </footer>
    );
}

export default function PerfilUsuario() {
    const navigate = useNavigate();
    const [usuarioData, setUsuarioData] = useState(null);
    const [tipo, setTipo] = useState("password");
    const [modalGuardar, setModalGuardar] = useState(false);
    const [nuevaContrasena, setNuevaContrasena] = useState("");
    const [enlaceActivo, setEnlaceActivo] = useState("Perfil");
    const [modalExito, setModalExito] = useState(false);
    const [subiendoFoto, setSubiendoFoto] = useState(false);
    // ← estado compartido

    const token = localStorage.getItem("token");
    const usuario = localStorage.getItem("usuario");

    useEffect(() => {
        fetch(`${API_URL}/usuario/usuario/${usuario}`, {
            method: "GET",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        })
            .then((res) => res.json())
            .then((data) => setUsuarioData(data))
            .catch((error) => console.error(error));
    }, []);

    async function manejarSubidaFoto(e) {
        const archivo = e.target.files?.[0];
        if (!archivo) return;

        // Limpiar el valor del input para permitir volver a seleccionar la misma imagen
        e.target.value = "";

        if (!archivo.type.startsWith("image/")) {
            alert("Solo se admiten archivos de imagen (PNG, JPG, JPEG, WEBP).");
            return;
        }

        // Límite de tamaño: 5 MB
        if (archivo.size > 5 * 1024 * 1024) {
            alert("La imagen no debe superar los 5MB de tamaño.");
            return;
        }

        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || cloudName === "TU_CLOUD_NAME" || !uploadPreset) {
            alert("Debes configurar tu VITE_CLOUDINARY_CLOUD_NAME y VITE_CLOUDINARY_UPLOAD_PRESET en el archivo FrontEnd/.env");
            return;
        }

        if (!usuarioData?.id) {
            alert("La información del usuario no está cargada todavía.");
            return;
        }

        try {
            setSubiendoFoto(true);

            // 1. Subida directa a Cloudinary con el preset sin firma
            const formData = new FormData();
            formData.append("file", archivo);
            formData.append("upload_preset", uploadPreset);

            const resCloudinary = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                { method: "POST", body: formData }
            );

            if (!resCloudinary.ok) {
                const errJson = await resCloudinary.json().catch(() => ({}));
                throw new Error(errJson?.error?.message || "Error al subir la imagen a Cloudinary");
            }

            const dataCloudinary = await resCloudinary.json();
            const urlSegura = dataCloudinary.secure_url;

            // 2. Actualizar el perfil en el backend
            const payload = {
                nombre: usuarioData?.nombre,
                apellido: usuarioData?.apellido,
                usuario: usuarioData?.usuario,
                correo: usuarioData?.correo,
                telefono: usuarioData?.telefono,
                activo: usuarioData?.activo ?? true,
                rol: usuarioData?.rol ?? "USUARIO",
                imagenUrl: urlSegura,
            };

            const resBackend = await fetch(`${API_URL}/usuario/${usuarioData.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload),
            });

            if (!resBackend.ok) {
                throw new Error("La imagen se subió a Cloudinary pero ocurrió un error guardando el perfil en la base de datos.");
            }

            const usuarioActualizado = await resBackend.json();
            setUsuarioData(usuarioActualizado);
        } catch (error) {
            console.error("Error al actualizar foto de perfil:", error);
            alert(error.message || "Error al subir la foto de perfil");
        } finally {
            setSubiendoFoto(false);
        }
    }

    function actualizarUsuario() {
        const payload = {
            nombre: usuarioData?.nombre,
            apellido: usuarioData?.apellido,
            usuario: usuarioData?.usuario,
            correo: usuarioData?.correo,
            telefono: usuarioData?.telefono,
            activo: usuarioData?.activo ?? true,
            rol: usuarioData?.rol ?? "USUARIO",
            imagenUrl: usuarioData?.imagenUrl,
        };

        fetch(`${API_URL}/usuario/${usuarioData.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        })
            .then((res) => {
                if (!res.ok) throw new Error("Error al actualizar");
                return res.json();
            })
            .then((data) => {
                setUsuarioData(data);
                setModalGuardar(false);
                setModalExito(true);
                setTimeout(() => {
                    navigate("/configuracion");
                }, 2000);
            })
            .catch((error) => console.error("Error actualizando usuario:", error));
    }

    return (
        <>
            {modalExito && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <span className="material-symbols-outlined modal-icon">
                            check_circle
                        </span>

                        <h3>Perfil actualizado correctamente</h3>
                        <p>Serás redirigido al panel...</p>
                    </div>
                </div>
            )}
            <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Manrope:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

            <div className="pagina-perfil">
                <FondoAurora />

                <div className="cuerpo-pagina">
                    <NavegacionLateral enlaceActivo={enlaceActivo} setEnlaceActivo={setEnlaceActivo} />

                    {enlaceActivo === "Perfil" ? (
                        <ContenidoPrincipal
                            usuarioData={usuarioData} setUsuarioData={setUsuarioData}
                            setModalGuardar={setModalGuardar}
                            onSubirFoto={manejarSubidaFoto}
                            subiendoFoto={subiendoFoto}
                            navigate={navigate}
                        />
                    ) : (
                        <PanelVehiculo />
                    )}
                </div>
                <ModalGuardar
                    modalGuardar={modalGuardar}
                    setModalGuardar={setModalGuardar}
                    actualizarUsuario={actualizarUsuario}
                />
            </div>
        </>
    );
}