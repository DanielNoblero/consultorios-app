import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const { login, loginWithGoogle, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate("/", { replace: true });
        }
    }, [user, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            navigate("/", { replace: true });
        } catch {
            setError("Correo o contraseña incorrectos");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError("");
        setLoading(true);
        try {
            await loginWithGoogle();
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
                <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Iniciar sesión</h2>

                {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
                        {loading ? "Entrando..." : "Entrar"}
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
                        {loading ? "Continuando..." : "Iniciar con Google"}
                    </button>
                </form>

                <p className="text-center text-sm mt-6 text-gray-600">
                    ¿No tienes cuenta?{" "}
                    <Link to="/register" className="text-blue-600 font-medium hover:underline">
                        Regístrate
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
