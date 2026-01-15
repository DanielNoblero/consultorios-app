import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, updateDoc } from "firebase/firestore";

const formatCurrency = (value) => Number(value || 0).toFixed(2);

const AdminBackups = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);

    const esAdmin = user?.rol === "admin" || user?.isAdmin;

    // 🔐 Protección frontend
    useEffect(() => {
        if (!esAdmin) navigate("/");
    }, [esAdmin, navigate]);

    // 📥 Escuchar backups
    useEffect(() => {
        const unsub = onSnapshot(
            collection(db, "reservas_backup"),
            (snapshot) => {
                const data = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));

                data.sort(
                    (a, b) =>
                        (b.eliminadaEn?.seconds || 0) -
                        (a.eliminadaEn?.seconds || 0)
                );

                setBackups(data);
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    // ♻️ Restaurar (Cloud Function)
    const restaurarReserva = async (backup) => {
        try {
            const original = backup.dataOriginal;

            if (!original?.id) {
                alert("❌ Backup inválido");
                return;
            }

            const { id, ...reservaLimpia } = original;

            // 🔁 Restaurar reserva (SIN el campo id)
            await setDoc(doc(db, "reservas", id), {
                ...reservaLimpia,
                restauradaDesdeBackup: true,
                restauradaEn: new Date().toISOString(),
            });

            // ✅ Marcar backup como restaurado
            await updateDoc(doc(db, "reservas_backup", backup.id), {
                restaurado: true,
                restauradoEn: new Date().toISOString(),
            });

            alert("✅ Reserva restaurada correctamente");
        } catch (error) {
            console.error(error);
            alert("❌ Error al restaurar la reserva");
        }
    };

    if (!esAdmin) return null;

    return (
        <div className="min-h-screen bg-slate-50 pt-24 px-4">
            <main className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg p-6">
                <h1 className="text-3xl font-extrabold text-slate-800 mb-4">
                    ♻️ Reservas eliminadas (Backup)
                </h1>

                <p className="text-sm text-slate-600 mb-6">
                    Historial de reservas eliminadas por psicólogos.
                    El backup no se borra.
                </p>

                {loading ? (
                    <p>Cargando backups...</p>
                ) : backups.length === 0 ? (
                    <div className="bg-sky-50 p-4 rounded-xl text-sky-700">
                        No hay reservas eliminadas.
                    </div>
                ) : (
                    <ul className="space-y-4">
                        {backups.map((b) => {
                            const r = b.dataOriginal || {};

                            return (
                                <li
                                    key={b.id}
                                    className="border rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3"
                                >
                                    <div className="text-sm space-y-1">
                                        <p className="font-semibold">
                                            🗓 {r.fecha} {r.horaInicio}–{r.horaFin} | Consultorio {r.consultorio}
                                        </p>
                                        <p>
                                            Psicólogo:{" "}
                                            <strong>
                                                {r.nombre} {r.apellido}
                                            </strong>
                                        </p>
                                        <p>Precio: ${formatCurrency(r.precio)}</p>
                                        <p className="text-xs text-slate-500">
                                            Eliminada:{" "}
                                            {b.eliminadaEn
                                                ? new Date(
                                                    b.eliminadaEn.seconds * 1000
                                                ).toLocaleString()
                                                : "—"}
                                        </p>
                                    </div>

                                    <button
                                        disabled={b.restaurado}
                                        onClick={() => restaurarReserva(b)}
                                        className={`self-start px-4 py-2 rounded-lg font-semibold transition
                                            ${b.restaurado
                                                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                                            }`}
                                    >
                                        {b.restaurado
                                            ? "✔ Restaurada"
                                            : "♻️ Restaurar"}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>
        </div>
    );
};

export default AdminBackups;
