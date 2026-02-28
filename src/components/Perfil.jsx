// src/pages/Perfil.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { updateEmail } from "firebase/auth";

const Perfil = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        nombre: "",
        apellido: "",
        telefono: "",
        email: "",
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const cargarPerfil = async () => {
            if (!user) return;

            try {
                const userRef = doc(db, "usuarios", user.uid);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const data = snap.data();

                    setForm({
                        nombre: data.nombre || "",
                        apellido: data.apellido || "",
                        telefono: data.telefono || "",
                        email: user.email || "",
                    });
                } else {
                    setForm({
                        ...form,
                        email: user.email || "",
                    });
                }
            } catch (err) {
                console.error("Error al obtener perfil:", err);
            } finally {
                setLoading(false);
            }
        };

        cargarPerfil();
    }, [user]);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    };

    const handleGuardar = async (e) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setErrorMsg("");

        try {
            // 🔹 Actualizar email en Auth si cambió
            if (form.email !== user.email) {
                try {
                    await updateEmail(user, form.email);
                } catch (err) {
                    if (err.code === "auth/requires-recent-login") {
                        setErrorMsg("Debes cerrar sesión y volver a iniciar sesión para cambiar tu email.");
                    } else {
                        setErrorMsg("No se pudo cambiar el email.");
                    }
                    setSaving(false);
                    return;
                }
            }

            const userRef = doc(db, "usuarios", user.uid);
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
                // 🔥 Usuario nuevo → crear documento completo
                await setDoc(userRef, {
                    nombre: form.nombre,
                    apellido: form.apellido,
                    telefono: form.telefono,
                    email: form.email,
                    rol: "psicologo",
                    perfilCompleto: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            } else {
                // ✅ Usuario existente → solo actualizar
                await setDoc(
                    userRef,
                    {
                        nombre: form.nombre,
                        apellido: form.apellido,
                        telefono: form.telefono,
                        email: form.email,
                        perfilCompleto: true,
                        updatedAt: new Date().toISOString(),
                    },
                    { merge: true }
                );
            }

            navigate("/dashboard");

        } catch (error) {
            console.error("Error guardando el perfil:", error);
            setErrorMsg("Hubo un error guardando el perfil.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-700 text-lg">Cargando perfil...</p>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="w-full max-w-xl bg-white p-6 sm:p-8 rounded-xl shadow-xl">

                <h2 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-gray-800">
                    Completar Perfil
                </h2>

                {errorMsg && (
                    <p className="text-red-600 text-center mb-4 font-medium">{errorMsg}</p>
                )}

                <form onSubmit={handleGuardar} className="space-y-5">

                    <div>
                        <label className="block font-medium mb-1">Nombre</label>
                        <input
                            type="text"
                            name="nombre"
                            value={form.nombre}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                        />
                    </div>

                    <div>
                        <label className="block font-medium mb-1">Apellido</label>
                        <input
                            type="text"
                            name="apellido"
                            value={form.apellido}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                        />
                    </div>

                    <div>
                        <label className="block font-medium mb-1">Teléfono</label>
                        <input
                            type="text"
                            name="telefono"
                            value={form.telefono}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                        />
                    </div>

                    <div>
                        <label className="block font-medium mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-400"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Si cambias el email, puede pedirse que vuelvas a iniciar sesión.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
                    >
                        {saving ? "Guardando..." : "Guardar Perfil"}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default Perfil;
