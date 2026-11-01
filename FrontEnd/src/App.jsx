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
import './Styles/App.css'

function App() {
  return (
    <Routes>
      {/* ── Públicas ── */}
      <Route path="/" element={
        <>
          <NavBar />
          <Hero />
          <Nosotros />
          <Producto />
          <Pricing />
          <Equipo />
          <Footer />
        </>
      } />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* ── Panel administrativo: solo ADMIN ── */}
      <Route path="/admin" element={
        <RutaProtegida soloAdmin>
          <Dashboard />
        </RutaProtegida>
      } />

      {/* ── Requieren sesión ── */}
      <Route path="/panel-control" element={
        <RutaProtegida>
          <PanelControl />
        </RutaProtegida>
      } />
      <Route path="/configuracion" element={
        <RutaProtegida>
          <PanelUsuario />
        </RutaProtegida>
      } />
      <Route path="/cambiar-contrasena" element={
        <RutaProtegida>
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
