import { Routes, Route, Navigate } from 'react-router-dom'
import NavBar from './Components/NavBar'
import Hero from './Components/Hero'
import Nosotros from './Components/Nosotros'
import Producto from './Components/Producto'
import Pricing from './Components/Pricing'
import Equipo from './Components/Equipo'
import Footer from './Components/Footer'
import Login from './Components/Login'
import PanelControl from './Components/PanelControl'
import PanelUsuario from './Components/PerfilUsuario'
import Registro from './Components/Registro'
import AuthCallback from './Components/AuthCallback'
import CambiarContrasena from './Components/CambiarContrasena'
import RecuperarContrasena from './Components/RecuperarContrasena'
import Dashboard from './Components/Dashboard'
import RutaProtegida from './Components/RutaProtegida'
import './Styles/Base.css'
import Legal from './Components/Legal'
import './Styles/App.css'
import ScrollReveal from './Components/ScrollReveal'
import ScrollExperience from './Components/ScrollExperience'
import Pago from './Components/Pago'
import Seo from './Components/Seo'

function App() {
  return (
    <Routes>
      {/* ── Públicas ── */}
      <Route path="/" element={
        <>
          <Seo
            title="ROMP GPS | Rastreo Satelital en Tiempo Real y Control de Flotas"
            description="Plataforma de rastreo satelital GPS 4G en tiempo real, apagado remoto de motor, sensores inerciales y telemetría de precisión para flotas y vehículos en Colombia."
            canonical="https://rompgps.com/"
          />
          <ScrollExperience />
          <NavBar />
          <Hero />
          <ScrollReveal><Nosotros /></ScrollReveal>
          <ScrollReveal><Producto /></ScrollReveal>
          <ScrollReveal><Pricing /></ScrollReveal>
          <ScrollReveal><Equipo /></ScrollReveal>
          <Footer />
        </>
      } />
      <Route path="/login" element={
        <>
          <Seo
            title="Iniciar Sesión | ROMP GPS Área de Clientes"
            description="Accede a la plataforma de rastreo en vivo de ROMP GPS. Monitorea tus vehículos, envía comandos de corte de motor y revisa la telemetría satelital."
            canonical="https://rompgps.com/login"
          />
          <Login />
        </>
      } />
      <Route path="/registro" element={
        <>
          <Seo
            title="Crear Cuenta | ROMP GPS Telemetría"
            description="Regístrate en ROMP GPS y conecta tus dispositivos GT06 para rastreo satelital 4G con telemetría de grado industrial."
            canonical="https://rompgps.com/registro"
          />
          <Registro />
        </>
      } />
      <Route path="/pago" element={
        <>
          <Seo
            title="Activar Plan y Pasarela de Pago | ROMP GPS"
            description="Elige tu plan de rastreo satelital (Plan Básico, Plan Garantía o Plan Premium) y realiza tu pago seguro en línea con Wompi."
            canonical="https://rompgps.com/pago"
          />
          <Pago />
        </>
      } />
      <Route path="/recuperar-contrasena" element={
        <>
          <Seo
            title="Recuperar Contraseña | ROMP GPS"
            description="Restablece el acceso a tu cuenta de ROMP GPS de forma segura."
            canonical="https://rompgps.com/recuperar-contrasena"
            noIndex={true}
          />
          <RecuperarContrasena />
        </>
      } />
      <Route path="/privacidad" element={
        <>
          <Seo
            title="Política de Privacidad y Tratamiento de Datos | ROMP GPS"
            description="Conoce nuestras políticas de privacidad y tratamiento de datos personales conforme a la Ley 1581 de 2012 de Colombia."
            canonical="https://rompgps.com/privacidad"
          />
          <Legal tipo="privacidad" />
        </>
      } />
      <Route path="/terminos" element={
        <>
          <Seo
            title="Términos y Condiciones del Servicio | ROMP GPS"
            description="Consulta los términos de uso y condiciones del servicio de telemetría y rastreo satelital vehicular de ROMP GPS."
            canonical="https://rompgps.com/terminos"
          />
          <Legal tipo="terminos" />
        </>
      } />
      <Route path="/auth/callback" element={
        <>
          <Seo
            title="Autenticando | ROMP GPS"
            noIndex={true}
          />
          <AuthCallback />
        </>
      } />

      {/* ── Panel administrativo: solo ADMIN ── */}
      <Route path="/admin" element={
        <RutaProtegida soloAdmin>
          <Seo
            title="Panel de Administración Central | ROMP GPS"
            noIndex={true}
          />
          <Dashboard />
        </RutaProtegida>
      } />

      {/* ── Requieren sesión ── */}
      <Route path="/panel-control" element={
        <RutaProtegida>
          <Seo
            title="Panel de Control y Mapa en Vivo | ROMP GPS"
            noIndex={true}
          />
          <PanelControl />
        </RutaProtegida>
      } />
      <Route path="/configuracion" element={
        <RutaProtegida>
          <Seo
            title="Configuración de Cuenta | ROMP GPS"
            noIndex={true}
          />
          <PanelUsuario />
        </RutaProtegida>
      } />
      <Route path="/cambiar-contrasena" element={
        <RutaProtegida>
          <Seo
            title="Seguridad y Cambio de Contraseña | ROMP GPS"
            noIndex={true}
          />
          <CambiarContrasena />
        </RutaProtegida>
      } />

      {/* Cualquier ruta desconocida vuelve al inicio en lugar de dejar la
          pantalla en blanco, que es lo que pasaba al no haber catch-all. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
