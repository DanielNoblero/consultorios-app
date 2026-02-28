import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PrivateRoute from "./routes/PrivateRoute";
import useCambioPrecio from "./utils/useCambioPrecio";
import PriceUpdateModal from "./components/PriceUpdateModal";
import Nav from "./components/Navbar.jsx";
import Login from "./components/Login.jsx";
import Register from "./components/Register.jsx";
import Perfil from "./components/Perfil.jsx";
import AdminBackups from "./pages/AdminBackups.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Reservas from "./pages/Reservas.jsx";
import Admin from "./pages/Admin.jsx";

function App() {
  const { mostrarModal, precioData, aceptarCambio } = useCambioPrecio();

  return (
    <Router>
      {mostrarModal && precioData && (
        <PriceUpdateModal
          precioBase={precioData.precioBase}
          precioDescuento={precioData.precioDescuento}
          fechaCambio={precioData.fechaCambio}
          onAccept={aceptarCambio}
        />
      )}
      
      <Nav />

      <Routes>
        {/* ------------------ RUTAS PUBLICAS ------------------ */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ------------------ PERFIL ------------------ */}
        <Route
          path="/perfil"
          element={
            <PrivateRoute requireProfile={false}>
              <Perfil />
            </PrivateRoute>
          }
        />

        {/* ------------------ DASHBOARD (RUTA PRINCIPAL) ------------------ */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute requireProfile>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* ------------------ RUTA "/" REDIRECCIONA A /dashboard ------------------ */}
        {/* Protegemos la ruta principal, asegurándonos de que el usuario tenga el perfil completo */}
        <Route
          path="/"
          element={
            <PrivateRoute requireProfile>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="/admin/backups" element={<AdminBackups />} />

        {/* ------------------ RESERVAS ------------------ */}
        <Route
          path="/reservas"
          element={
            <PrivateRoute requireProfile>
              <Reservas />
            </PrivateRoute>
          }
        />

        {/* ------------------ ADMIN ------------------ */}
        <Route
          path="/admin"
          element={
            <PrivateRoute adminOnly requireProfile>
              <Admin />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
