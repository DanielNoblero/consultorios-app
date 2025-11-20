// src/routes/PrivateRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoaderScreen from "../components/LoaderScreen";

const PrivateRoute = ({ children, adminOnly = false, requireProfile = true }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <LoaderScreen />;

    // No logueado → login
    if (!user) return <Navigate to="/login" replace />;

    // Rutas ADMIN
    if (adminOnly && !user.isAdmin) {
        return <Navigate to="/" replace />;
    }

    // PERMITIR ACCEDER A /perfil SIEMPRE
    if (location.pathname === "/perfil") {
        return children;
    }

    // Otras rutas → requieren perfil completo
    if (requireProfile && !user.perfilCompleto) {
        return <Navigate to="/perfil" replace />;
    }

    return children;
};

export default PrivateRoute;
