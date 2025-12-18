// src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getMonday, getSunday, eliminarReserva } from "../utils/reservasUtils";
import ModalRecurrente from "../components/ModalRecurrente";

const CONFIG_DOC_ID = "precioConsulta";

const formatCurrency = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
};

// ────────────────────────────────────────────────
// COMPONENTES AUXILIARES (mismo diseño que antes)
// ────────────────────────────────────────────────
const Notification = ({ tipo, mensaje }) => (
    <div
        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white font-semibold transition-all duration-300 ease-out ${tipo === "success" ? "bg-green-500" : "bg-red-500"
            }`}
    >
        {mensaje}
    </div>
);

const CancelarModal = ({ isOpen, onClose, onConfirm, reserva }) => {
    if (!isOpen || !reserva) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-2xl font-extrabold mb-3 text-red-600 border-b pb-2">
                    ⚠️ Confirmar Cancelación
                </h3>
                <p className="text-gray-700 mb-4">
                    ¿Estás seguro de que deseas cancelar la siguiente reserva?
                </p>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-sm font-medium">
                    <p>
                        🗓 Consultorio {reserva.consultorio}: {reserva.fecha}
                    </p>
                    <p>
                        🕒 Horario: {reserva.horaInicio} - {reserva.horaFin}
                    </p>
                    <p className="mt-1">
                        Costo: ${formatCurrency(reserva.precio)}
                    </p>
                </div>
                <p className="mt-3 text-sm text-red-700 font-semibold">
                    Solo se permiten cancelaciones con más de 24 horas de
                    antelación.
                </p>
                <div className="flex justify-end mt-6 gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                    >
                        No, volver
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold shadow-md"
                    >
                        Sí, cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeudaCards = ({ totalSemana, totalMes, totalMesAnterior, nombreMesAnterior }) => (
    <section className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Semana */}
        <div className="bg-white rounded-2xl shadow-lg border border-sky-100 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-600">Deuda de esta semana</span>
            <p className="text-3xl font-extrabold">
                ${formatCurrency(totalSemana)}
            </p>
            <p className="text-xs text-slate-500">Suma de todas las consultas no pagas dentro de la semana actual.</p>
        </div>

        {/* Mes actual */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Deuda del mes</span>
            <p className="text-3xl font-extrabold">
                ${formatCurrency(totalMes)}
            </p>
            <p className="text-xs text-slate-500">Incluye todas las reservas pendientes de pago del mes.</p>
        </div>

        {/* Mes anterior (solo si hay deuda) */}
        {totalMesAnterior > 0 && (
            <div className="bg-amber-50 rounded-2xl shadow-lg border border-amber-200 p-4">
                <span className="text-xs font-semibold text-amber-700">
                    Deuda {nombreMesAnterior}
                </span>
                <p className="text-3xl font-extrabold text-amber-900">
                    ${formatCurrency(totalMesAnterior)}
                </p>
            </div>
        )}
    </section>
);

// ────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────
const Dashboard = () => {
    const meses = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
    ];

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [reservas, setReservas] = useState([]);
    const [precioGlobal, setPrecioGlobal] = useState(null);
    const [totalSemana, setTotalSemana] = useState(0);
    const [totalMes, setTotalMes] = useState(0);

    const [reservaACancelar, setReservaACancelar] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [notificacion, setNotificacion] = useState(null);

    const [mostrarSemana, setMostrarSemana] = useState(true);
    const [mostrarPasadas, setMostrarPasadas] = useState(false);
    const [nombreMesAnterior, setNombreMesAnterior] = useState("");
    const [nombreMesActual, setNombreMesActual] = useState("");
    const [nombreMesSiguiente, setNombreMesSiguiente] = useState("");
    const [totalMesAnterior, setTotalMesAnterior] = useState(0);
    const [vista, setVista] = useState("semana");
    const [reservasMes, setReservasMes] = useState({ semanas: {}, plano: [] });
    const [totalMesVista, setTotalMesVista] = useState(0);
    const [reservasMesSiguiente, setReservasMesSiguiente] = useState([]);

    const [modalRecurrente, setModalRecurrente] = useState(null);

    const capitalize = (str) => {
        if (!str) return "";
        return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    };

    // 🔹 Cargar precio global (1 sola vez)
    useEffect(() => {
        const fetchPrecio = async () => {
            try {
                const snap = await getDoc(doc(db, "configuracion", CONFIG_DOC_ID));
                setPrecioGlobal(
                    snap.exists()
                        ? parseFloat(snap.data().precioBase || 250)
                        : 250
                );
            } catch (error) {
                console.error("Error cargando precio global:", error);
                setPrecioGlobal(250);
            }
        };
        fetchPrecio();
    }, []);

    // 🔹 Suscripción a reservas del psicólogo
    useEffect(() => {
        if (!user?.uid || precioGlobal === null) return;

        const q = query(
            collection(db, "reservas"),
            where("psicologoId", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reservasArray = snapshot.docs.map((doc) => {
                const data = { id: doc.id, ...doc.data() };
                const precio = parseFloat(data.precio ?? precioGlobal);
                return { ...data, precio };
            });

            reservasArray.sort(
                (a, b) =>
                    new Date(`${a.fecha}T${a.horaInicio}`) -
                    new Date(`${b.fecha}T${b.horaInicio}`)
            );

            setReservas(reservasArray);

            // ───────────────────────────────────────────────
            // CÁLCULO DEUDA SEMANAL
            // ───────────────────────────────────────────────
            const hoySemana = new Date();
            const lunesSemana = getMonday(hoySemana);
            const domingoSemana = getSunday(hoySemana);

            const deudaSemana = reservasArray
                .filter((r) => {
                    const fecha = new Date(`${r.fecha}T${r.horaInicio}`);
                    return (
                        fecha >= lunesSemana &&
                        fecha <= domingoSemana &&
                        !r.pagado
                    );
                })
                .reduce((acc, r) => acc + Number(r.precio || 0), 0);

            setTotalSemana(deudaSemana);

            // ───────────────────────────────────────────────
            // CÁLCULO DEUDA MENSUAL
            // ───────────────────────────────────────────────
            const hoyCalc = new Date();
            const mesCalc = hoyCalc.getMonth();
            const añoCalc = hoyCalc.getFullYear();

            const deudaMes = reservasArray
                .filter((r) => {
                    const fecha = new Date(`${r.fecha}T00:00:00`);
                    return (
                        fecha.getMonth() === mesCalc &&
                        fecha.getFullYear() === añoCalc &&
                        !r.pagado
                    );
                })
                .reduce((acc, r) => acc + Number(r.precio || 0), 0);

            setTotalMes(deudaMes);
            // ───────────────────────────────────────────────
            // CÁLCULO DEUDA MES ANTERIOR
            // ───────────────────────────────────────────────
            const mesAnterior =
                mesCalc === 0 ? 11 : mesCalc - 1;

            const añoMesAnterior =
                mesCalc === 0 ? añoCalc - 1 : añoCalc;

            setNombreMesAnterior(meses[mesAnterior]);

            const deudaMesAnterior = reservasArray
                .filter((r) => {
                    const fecha = new Date(`${r.fecha}T00:00:00`);
                    return (
                        fecha.getMonth() === mesAnterior &&
                        fecha.getFullYear() === añoMesAnterior &&
                        !r.pagado
                    );
                })
                .reduce((acc, r) => acc + Number(r.precio || 0), 0);

            setTotalMesAnterior(deudaMesAnterior);
            // ───────────────────────────────────────────────
            // MES ACTUAL / SIGUIENTE
            // ───────────────────────────────────────────────
            const hoy = new Date();
            const year = hoy.getFullYear();
            const month = hoy.getMonth();

            setNombreMesActual(meses[month]);
            const nextMonth = (month + 1) % 12;
            setNombreMesSiguiente(meses[nextMonth]);

            const reservasMesActual = reservasArray.filter((r) => {
                const f = new Date(`${r.fecha}T00:00:00`);
                return f.getMonth() === month && f.getFullYear() === year;
            });

            const total = reservasMesActual.reduce(
                (acc, r) => acc + (r.precio || 0),
                0
            );
            setTotalMesVista(total);

            const semanasAgrupadas = {};
            reservasMesActual.forEach((r) => {
                const f = new Date(`${r.fecha}T00:00:00`);
                const semana = Math.ceil(f.getDate() / 7);
                if (!semanasAgrupadas[semana]) semanasAgrupadas[semana] = [];
                semanasAgrupadas[semana].push(r);
            });

            setReservasMes({
                semanas: semanasAgrupadas,
                plano: reservasMesActual,
            });

            const nextYear = month === 11 ? year + 1 : year;
            const reservasSiguiente = reservasArray.filter((r) => {
                const f = new Date(`${r.fecha}T00:00:00`);
                return (
                    f.getMonth() === nextMonth && f.getFullYear() === nextYear
                );
            });
            setReservasMesSiguiente(reservasSiguiente);
        });

        return () => unsubscribe();
    }, [user, precioGlobal]);

    const handleConfirmCancel = (reserva) => {
        setReservaACancelar(reserva);
        setIsModalOpen(true);
    };

    const mostrarNotificacion = (tipo, mensaje) => {
        setNotificacion({ tipo, mensaje });
        setTimeout(() => setNotificacion(null), 3000);
    };

    const handleCancelar = async () => {
        if (!reservaACancelar) {
            setIsModalOpen(false);
            return;
        }

        const ahora = new Date();
        const fechaReserva = new Date(
            `${reservaACancelar.fecha}T${reservaACancelar.horaInicio}`
        );
        const diferenciaHoras =
            (fechaReserva - ahora) / (1000 * 60 * 60);

        setIsModalOpen(false);

        if (diferenciaHoras < 24) {
            mostrarNotificacion(
                "error",
                "⛔ No puedes cancelar con menos de 24 horas de anticipación."
            );
            setReservaACancelar(null);
            return;
        }

        try {
            await eliminarReserva(reservaACancelar, false);
            mostrarNotificacion(
                "success",
                "✅ Reserva cancelada correctamente."
            );
            setReservaACancelar(null);
        } catch (error) {
            console.error(error);
            mostrarNotificacion(
                "error",
                "❌ Ocurrió un error al cancelar la reserva."
            );
        }
    };

    const ahora = new Date();
    const lunes = getMonday(ahora);
    const domingo = getSunday(ahora);

    const reservasSemanaMostrar = reservas.filter((r) => {
        const fecha = new Date(`${r.fecha}T${r.horaInicio}`);
        return fecha >= lunes && fecha <= domingo;
    });

    const reservasPasadas = reservas.filter(
        (r) => new Date(`${r.fecha}T${r.horaInicio}`) < ahora
    );

    // Tomamos datos directamente de user (AuthContext ya mezcla Firestore)
    const nombreUsuario = capitalize(
        user?.nombre || user?.displayName?.split(" ")[0] || "Usuario"
    );

    const apellidoUsuario = capitalize(
        user?.apellido ||
        user?.displayName?.split(" ").slice(1).join(" ") ||
        ""
    );

    const nombreCompleto = `${nombreUsuario} ${apellidoUsuario}`.trim();

    const iniciales =
        (nombreUsuario?.[0] || "U") + (apellidoUsuario?.[0] || "");

    const esAdmin = user?.rol === "admin" || user?.isAdmin;

    const eliminarSoloUna = async () => {
        try {
            await eliminarReserva(modalRecurrente, false);
            setModalRecurrente(null);
            mostrarNotificacion(
                "success",
                "Reserva eliminada correctamente."
            );
        } catch (e) {
            console.error(e);
            mostrarNotificacion("error", "Error al eliminar la reserva.");
        }
    };

    const eliminarTodaLaSerie = async () => {
        try {
            await eliminarReserva(modalRecurrente, true);
            setModalRecurrente(null);
            mostrarNotificacion(
                "success",
                "Toda la serie recurrente fue eliminada."
            );
        } catch (e) {
            console.error(e);
            mostrarNotificacion("error", "Error al eliminar la serie.");
        }
    };

    const ReservaItem = ({ r }) => {
        const fechaReserva = new Date(`${r.fecha}T${r.horaInicio}`);
        const puedeCancelar =
            fechaReserva - ahora >= 24 * 60 * 60 * 1000; // 24h

        const estadoPago = esAdmin
            ? null
            : r.pagado ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    Pagado ✅
                </span>
            ) : (
                <span className="text-amber-700 font-semibold flex items-center gap-1">
                    Pendiente de pago ⚠️
                </span>
            );

        const baseClass =
            "flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border shadow-sm transition duration-200 ease-in-out";
        const futureClass = !r.pagado
            ? "bg-red-50 hover:bg-red-100 border-red-200"
            : "bg-white hover:bg-slate-50 border-slate-200";
        const pastClass = "bg-slate-50 border-slate-200 opacity-80";

        return (
            <li
                key={r.id}
                className={`${baseClass} ${fechaReserva >= ahora ? futureClass : pastClass
                    }`}
            >
                <div className="text-sm sm:text-base space-y-1">
                    <p className="font-semibold text-slate-900">
                        🗓 {r.fecha} {r.horaInicio}-{r.horaFin}
                        <span className="text-sky-600 ml-2">
                            (Consultorio {r.consultorio})
                        </span>
                    </p>

                    <p className="text-slate-700">
                        Precio: ${formatCurrency(r.precio)}
                        {!esAdmin && <> | {estadoPago}</>}
                    </p>
                </div>

                {puedeCancelar && (
                    <button
                        onClick={() => {
                            if (r.groupId) {
                                setModalRecurrente(r);
                            } else {
                                handleConfirmCancel(r);
                            }
                        }}
                        className="mt-3 sm:mt-0 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition shadow-md text-sm font-semibold"
                    >
                        ❌ Cancelar
                    </button>
                )}
            </li>
        );
    };

    // ------------------- UI PRINCIPAL -------------------
    return (
        <div className="min-h-screen bg-slate-50 pt-24 pb-10 px-4">
            {notificacion && <Notification {...notificacion} />}

            <main className="max-w-6xl mx-auto flex flex-col gap-6 md:gap-8">
                <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <p className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-sky-100 text-sky-700 mb-2">
                            Panel de control
                        </p>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                            Hola, {nombreCompleto}
                        </h1>
                        <p className="text-sm sm:text-base text-slate-600 mt-2">
                            Aquí puedes ver tus próximas reservas, historial y
                            deudas pendientes.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 self-start md:self-auto">
                        <div className="h-12 w-12 rounded-full bg-sky-600 text-white flex items-center justify-center text-xl font-bold shadow-md">
                            {iniciales || "U"}
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="text-sm font-semibold text-slate-800">
                                {nombreCompleto}
                            </span>
                            <span className="text-xs text-slate-500">
                                Profesional activo
                            </span>
                        </div>
                    </div>
                </section>

                <DeudaCards totalSemana={totalSemana} totalMes={totalMes} totalMesAnterior={totalMesAnterior} nombreMesAnterior={nombreMesAnterior} />

                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-sky-100 p-6">
                        {/* BOTONES SEMANA/MES */}
                        <div className="flex gap-3 mb-4">
                            <button
                                onClick={() => setVista("semana")}
                                className={`px-4 py-2 rounded-lg font-semibold transition ${vista === "semana"
                                    ? "bg-sky-600 text-white shadow"
                                    : "bg-white border border-sky-300 text-sky-700"
                                    }`}
                            >
                                Semana actual
                            </button>

                            <button
                                onClick={() => setVista("mes")}
                                className={`px-4 py-2 rounded-lg font-semibold transition ${vista === "mes"
                                    ? "bg-sky-600 text-white shadow"
                                    : "bg-white border border-sky-300 text-sky-700"
                                    }`}
                            >
                                Mes actual
                            </button>

                            <button
                                onClick={() => setVista("mesSiguiente")}
                                className={`px-4 py-2 rounded-lg font-semibold transition ${vista === "mesSiguiente"
                                    ? "bg-sky-600 text-white shadow"
                                    : "bg-white border border-sky-300 text-sky-700"
                                    }`}
                            >
                                Mes siguiente
                            </button>
                        </div>

                        {/* TÍTULO */}
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-sky-800">
                                {vista === "semana" && "Próximas reservas"}
                                {vista === "mes" &&
                                    `Próximas reservas — ${nombreMesActual}`}
                                {vista === "mesSiguiente" &&
                                    `Próximas reservas — ${nombreMesSiguiente}`}{" "}
                                (
                                {vista === "semana"
                                    ? reservasSemanaMostrar.length
                                    : vista === "mes"
                                        ? reservasMes.plano.length
                                        : reservasMesSiguiente.length}
                                )
                            </h2>

                            <button
                                onClick={() =>
                                    setMostrarSemana(!mostrarSemana)
                                }
                                className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-800"
                            >
                                {mostrarSemana ? "Contraer ▲" : "Extender ▼"}
                            </button>
                        </div>

                        {/* LISTA SEMANAL */}
                        {vista === "semana" && mostrarSemana && (
                            reservasSemanaMostrar.length === 0 ? (
                                <div className="p-4 rounded-xl bg-sky-50 text-sky-800 text-sm sm:text-base">
                                    🎉 No tienes reservas esta semana.{" "}
                                    <button
                                        onClick={() =>
                                            navigate("/reservas")
                                        }
                                        className="font-semibold underline hover:text-sky-900"
                                    >
                                        Agendar una ahora
                                    </button>
                                    .
                                </div>
                            ) : (
                                <ul className="space-y-4">
                                    {reservasSemanaMostrar.map((r) => (
                                        <ReservaItem key={r.id} r={r} />
                                    ))}
                                </ul>
                            )
                        )}

                        {/* LISTA MENSUAL */}
                        {vista === "mes" && mostrarSemana && (
                            <ul className="space-y-4">
                                {reservasMes.plano.map((r) => (
                                    <ReservaItem key={r.id} r={r} />
                                ))}
                                {reservasMes.plano.length === 0 && (
                                    <div className="p-4 rounded-xl bg-sky-50 text-sky-800 text-sm sm:text-base">
                                        🎉 No tienes reservas este mes.{" "}
                                        <button
                                            onClick={() =>
                                                navigate("/reservas")
                                            }
                                            className="font-semibold underline hover:text-sky-900"
                                        >
                                            Agendar una ahora
                                        </button>
                                        .
                                    </div>
                                )}
                            </ul>
                        )}

                        {vista === "mesSiguiente" && mostrarSemana && (
                            <ul className="space-y-4">
                                {reservasMesSiguiente.map((r) => (
                                    <ReservaItem key={r.id} r={r} />
                                ))}
                                {reservasMesSiguiente.length === 0 && (
                                    <div className="p-4 rounded-xl bg-sky-50 text-sky-800 text-sm sm:text-base">
                                        🎉 No tienes reservas ese mes.{" "}
                                        <button
                                            onClick={() =>
                                                navigate("/reservas")
                                            }
                                            className="font-semibold underline hover:text-sky-900"
                                        >
                                            Agendar una ahora
                                        </button>
                                        .
                                    </div>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* COLUMNA DERECHA - HISTORIAL */}
                    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                                Historial ({reservasPasadas.length})
                            </h2>
                            <button
                                onClick={() =>
                                    setMostrarPasadas(!mostrarPasadas)
                                }
                                className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800"
                            >
                                {mostrarPasadas
                                    ? "Contraer ▲"
                                    : "Extender ▼"}
                            </button>
                        </div>

                        {mostrarPasadas &&
                            (reservasPasadas.length === 0 ? (
                                <p className="text-sm sm:text-base text-slate-500">
                                    Aún no tienes reservas en tu historial.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {reservasPasadas.map((r) => (
                                        <ReservaItem key={r.id} r={r} />
                                    ))}
                                </ul>
                            ))}
                    </div>
                </section>

                <section className="flex flex-col sm:flex-row gap-4 mt-2 w-full">
                    <button
                        onClick={() => navigate("/reservas")}
                        className="flex-1 bg-sky-600 text-white px-6 py-3 rounded-xl hover:bg-sky-700 transition shadow-lg font-semibold text-base sm:text-lg flex items-center justify-center gap-2"
                    >
                        Agendar nueva reserva
                    </button>

                    <button
                        onClick={logout}
                        className="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl hover:bg-red-600 transition shadow-lg font-semibold text-base sm:text-lg flex items-center justify-center gap-2"
                    >
                        Cerrar sesión
                    </button>
                </section>
            </main>

            <CancelarModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleCancelar}
                reserva={reservaACancelar}
            />

            <ModalRecurrente
                isOpen={!!modalRecurrente}
                onClose={() => setModalRecurrente(null)}
                onEliminarUna={eliminarSoloUna}
                onEliminarTodas={eliminarTodaLaSerie}
                reserva={modalRecurrente}
            />
        </div>
    );
};

export default Dashboard;
