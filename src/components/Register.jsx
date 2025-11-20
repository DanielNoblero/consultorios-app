import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Register = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { register, loginWithGoogle, user } = useAuth();
    const navigate = useNavigate();

    // Redirección si el usuario ya está autenticado
    useEffect(() => {
        if (user && user.perfilCompleto) {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await register(email, password);
            // Redirigir a perfil después de un nuevo registro
            navigate("/perfil", { replace: true }); 
        } catch (err) {
            // Este catch atrapará el error de "auth/email-already-in-use"
            setError("Error: El correo electrónico ya está registrado. Intenta iniciar sesión.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setLoading(true);
        try {
            await loginWithGoogle();
            // Google SignIn maneja tanto el login como el registro inicial.
            // Redirigimos a la raíz, y PrivateRoute se encargará de enviarlo a /perfil si es nuevo o incompleto.
            navigate("/", { replace: true }); 
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Crear cuenta</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-sm" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    <input
                        type="email"
                        placeholder="Correo electrónico"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        disabled={loading}
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        disabled={loading}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className={`bg-blue-700 text-white py-3 rounded-lg font-semibold transition ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-800'}`}
                    >
                        {loading ? "Registrando..." : "Registrarse"}
                    </button>

                    <div className="relative flex items-center justify-center my-4">
                        <span className="absolute bg-white px-2 text-gray-500 text-sm">o</span>
                        <hr className="w-full border-gray-300" />
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className={`w-full flex items-center justify-center border py-3 rounded-lg transition font-medium text-gray-700 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
                    >
                        <img
                            src="https://www.svgrepo.com/show/475656/google-color.svg"
                            alt="Google"
                            className="w-5 h-5 mr-2"
                        />
                        {loading ? "Continuando..." : "Continuar con Google"}
                    </button>
                </form>

                <p className="text-center text-sm mt-6 text-gray-600">
                    ¿Ya tienes cuenta?{" "}
                    <Link to="/login" className="text-blue-600 font-medium hover:underline">
                        Iniciar sesión
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
