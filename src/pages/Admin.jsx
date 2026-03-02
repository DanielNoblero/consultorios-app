import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebaseConfig";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    updateDoc,
    getDoc,
    setDoc,
    query,
    where,
} from "firebase/firestore";
import {
    Home,
    Users,
    DollarSign,
    Calendar,
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

import { marcarMesPagadoUsuario, marcarMesDeudaUsuario, } from "../utils/pagosUtils";
import { getFunctions, httpsCallable } from "firebase/functions";
const CONFIG_DOC_ID = "precioConsulta";

// ============================
// HELPERS DE FECHA / MES
// ============================
const formatDate = (year, month, day) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const getMonthRange = (offset = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);

    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    return {
        from: formatDate(year, month, 1),
        to: formatDate(year, month, lastDay),
    };
};
// ============================
// HELPER NOMBRE DE MES
// ============================
const getNombreMes = (offset = 0) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);

    const nombresMes = [
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

    return `${nombresMes[d.getMonth()]} ${d.getFullYear()}`;
};
// ============================
// HELPERS USUARIOS
// ============================
const getNombreCompleto = (u) => {
    if (!u) return "Usuario";
    const nombre = u.nombre?.trim() || "";
    const apellido = u.apellido?.trim() || "";
    return `${nombre} ${apellido}`.trim() || "Sin nombre";
};

const Admin = () => {
    const [psicologos, setPsicologos] = useState([]);
    const [reservas, setReservas] = useState([]);

    const [precioConsulta, setPrecioConsulta] = useState(250);
    const [precioDescuento, setPrecioDescuento] = useState(230);

    const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({});
    const [expandAll, setExpandAll] = useState(false);
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [esMobile, setEsMobile] = useState(() => window.innerWidth < 768);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalTitle, setModalTitle] = useState("");
    const [modalConfirm, setModalConfirm] = useState(null);

    // 🔹 0 = mes actual, 1 = mes siguiente
    const [monthOffset, setMonthOffset] = useState(0);

    // Detectar mobile
    useEffect(() => {
        const handleResize = () => setEsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Reservas del mes según filtro (actual / siguiente)
    useEffect(() => {
        const { from, to } = getMonthRange(monthOffset);

        const reservasRef = collection(db, "reservas");
        const reservasQuery = query(
            reservasRef,
            where("fecha", ">=", from),
            where("fecha", "<=", to)
        );

        const unsub = onSnapshot(reservasQuery, (snapshot) => {
            setReservas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsub();
    }, [monthOffset]);

    // Psicólogos
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            setPsicologos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    // Cargar precios
    useEffect(() => {
        const fetchPrecio = async () => {
            try {
                const ref = doc(db, "configuracion", CONFIG_DOC_ID);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    setPrecioConsulta(parseFloat(data.precioBase || data.precio || 250));
                    setPrecioDescuento(parseFloat(data.precioDescuento || 230));
                }
            } catch (e) {
                console.error("Error cargando configuración de precios", e);
            }
        };
        fetchPrecio();
    }, []);

    // 🧠 Memo: totales, deuda y reservas agrupadas por psicólogo
    const {
        totalConsultasMes,
        totalDineroMes,
        deudaPorPsicologo,
        reservasPorPsicologo,
    } = useMemo(() => {
        const deudaMap = {};
        const reservasMap = {};
        let totalConsultas = 0;
        let totalDinero = 0;

        reservas.forEach((r) => {
            const precio = parseFloat(r.precio || 0) || 0;
            totalConsultas += 1;
            totalDinero += precio;

            const psicologoId = r.psicologoId;
            if (!psicologoId) return;

            if (!reservasMap[psicologoId]) reservasMap[psicologoId] = [];
            reservasMap[psicologoId].push(r);

            if (!r.pagado && precio > 0) {
                deudaMap[psicologoId] = (deudaMap[psicologoId] || 0) + precio;
            }
        });

        Object.values(reservasMap).forEach((lista) => {
            lista.sort((a, b) => {
                const dateA = new Date(`${a.fecha}T${a.horaInicio}`);
                const dateB = new Date(`${b.fecha}T${b.horaInicio}`);
                return dateA - dateB;
            });
        });

        return {
            totalConsultasMes: totalConsultas,
            totalDineroMes: totalDinero,
            deudaPorPsicologo: deudaMap,
            reservasPorPsicologo: reservasMap,
        };
    }, [reservas]);

    // 🧠 Memo: orden de psicólogos (admin primero, luego psicólogos)
    const psicologosOrdenados = useMemo(() => {
        return [...psicologos].sort((a, b) => {
            // 1️⃣ Admins primero
            if (a.rol === "admin" && b.rol !== "admin") return -1;
            if (a.rol !== "admin" && b.rol === "admin") return 1;

            // 2️⃣ Orden alfabético por nombre + apellido
            const nombreA = `${a.nombre ?? ""} ${a.apellido ?? ""}`
                .trim()
                .toLowerCase();

            const nombreB = `${b.nombre ?? ""} ${b.apellido ?? ""}`
                .trim()
                .toLowerCase();

            return nombreA.localeCompare(nombreB, "es", { sensitivity: "base" });
        });
    }, [psicologos]);

    // Label para saber qué mes se está viendo
    const monthLabel = monthOffset === -1 ? "Mes anterior" : monthOffset === 0 ? "Mes actual" : "Mes siguiente";

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 pt-24">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                <p className="text-xl text-blue-600 mt-4 font-medium">
                    Cargando datos de administración...
                </p>
            </div>
        );
    }

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalConfirm(() => confirmAction);
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setModalMessage("");
        setModalConfirm(null);
    };

    const handleGuardarPrecio = async () => {
        setIsSavingPrice(true);
        try {
            const hoy = new Date().toISOString().split("T")[0]; // Formato YYYY-MM-DD
            const ref = doc(db, "configuracion", CONFIG_DOC_ID);

            await setDoc(
                ref,
                {
                    precioBase: parseFloat(precioConsulta),
                    precioDescuento: parseFloat(precioDescuento),
                    fechaCambio: hoy, // Importante para useCambioPrecio.js
                    ultimaActualizacion: new Date().getTime(), // Asegura que el trigger de Cloud Functions siempre se dispare
                },
                { merge: true }
            );
            openModal("✅ Éxito", "Precios actualizados correctamente.");
        } catch (error) {
            console.error(error);
            openModal("❌ Error", "Error al actualizar los precios.");
        } finally {
            setIsSavingPrice(false);
        }
    };

    const handleCambiarRol = async (psicologoId, nuevoRol) => {
        const psicologo = psicologos.find((p) => p.id === psicologoId);
        openModal(
            "Cambiar Rol",
            `¿Seguro que quieres cambiar el rol de ${psicologo?.nombre || "este psicólogo"
            } a ${nuevoRol}?`,
            async () => {
                try {
                    const ref = doc(db, "usuarios", psicologoId);
                    await updateDoc(ref, { rol: nuevoRol });
                    openModal("✅ Éxito", "Rol actualizado correctamente");
                } catch (error) {
                    console.error(error);
                    openModal("❌ Error", "Error al actualizar el rol.");
                }
            }
        );
    };

    const calcularDeudaDelMes = (psicologoId) =>
        parseFloat(deudaPorPsicologo[psicologoId] || 0).toFixed(2);

    const handleEliminar = async (reservaId) => {
        openModal(
            "Eliminar Reserva",
            "⚠️ Esta acción eliminará la reserva y generará un backup. ¿Deseas continuar?",
            async () => {
                try {
                    const functions = getFunctions();
                    const eliminarReserva = httpsCallable(functions, "eliminarReservaConBackup");

                    await eliminarReserva({
                        reservaId,
                        motivo: "Eliminación manual desde panel admin"
                    });

                    openModal(
                        "🗑️ Reserva eliminada",
                        "La reserva fue eliminada y guardada en el backup correctamente."
                    );
                } catch (error) {
                    console.error(error);
                    openModal(
                        "❌ Error",
                        "No se pudo eliminar la reserva."
                    );
                }
            }
        );
    };

    const generarReporte = async () => {
        try {
            const url = "https://generarreportemanual-onau7gysfq-uc.a.run.app";
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error("Error al generar el reporte");
            }

            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);

            // 👇 Nombre dinámico: reporte-mes-año.xlsx (mes pasado)
            const ahora = new Date();
            let mes = ahora.getMonth() - 1; // mes pasado
            let anio = ahora.getFullYear();

            if (mes < 0) {
                mes = 11; // diciembre
                anio = anio - 1; // año anterior
            }

            const nombresMes = [
                "enero",
                "febrero",
                "marzo",
                "abril",
                "mayo",
                "junio",
                "julio",
                "agosto",
                "setiembre",
                "octubre",
                "noviembre",
                "diciembre",
            ];

            const nombreMes = nombresMes[mes];
            link.download = `reporte-${nombreMes}-${anio}.xlsx`;

            link.click();
        } catch (error) {
            console.error(error);
            openModal("❌ Error", "No se pudo generar el reporte mensual.");
        }
    };

    const togglePago = async (reserva) => {
        try {
            const ref = doc(db, "reservas", reserva.id);
            await updateDoc(ref, { pagado: !reserva.pagado });
            openModal("✅ Actualizado", "Estado de pago actualizado.");
        } catch (error) {
            console.error(error);
            openModal("❌ Error", "Error al actualizar estado de pago.");
        }
    };

    // 🔹 Año y mes según offset (0 = actual, 1 = siguiente)
    const getYearMonthFromOffset = (offset) => {
        const now = new Date();
        now.setMonth(now.getMonth() + offset);
        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1, // 1-12
        };
    };

    // 🔹 Toggle: si hay deuda → pagar; si todo está pago → marcar como deuda
    const handlePagarMesUsuario = (psicologoId, nombre, hayDeudaMes) => {
        const { year, month } = getYearMonthFromOffset(monthOffset);
        const labelMes = monthOffset === -1 ? "mes anterior" : monthOffset === 0 ? "mes actual" : "mes siguiente";

        if (hayDeudaMes) {
            // Caso normal: HAY deuda → marcar como pagado
            openModal(
                "Confirmar pago del mes",
                `¿Marcar como PAGADAS todas las reservas NO pagadas del ${labelMes} para ${nombre || "este profesional"
                }?`,
                async () => {
                    try {
                        const cantidad = await marcarMesPagadoUsuario(
                            psicologoId,
                            year,
                            month
                        );

                        if (cantidad > 0) {
                            openModal(
                                "✅ Pagos actualizados",
                                `Se marcaron ${cantidad} reservas como pagadas.`
                            );
                        } else {
                            openModal(
                                "ℹ️ Sin cambios",
                                "No había reservas pendientes de pago para ese período."
                            );
                        }
                    } catch (error) {
                        console.error(error);
                        openModal(
                            "❌ Error",
                            "No se pudieron actualizar los pagos del mes."
                        );
                    }
                }
            );
        } else {
            // NO hay deuda (todo pagado) → opción de revertir y volver a deuda
            openModal(
                "Confirmar revertir pago",
                `¿Marcar como DEUDA todas las reservas del ${labelMes} para ${nombre || "este profesional"
                }?`,
                async () => {
                    try {
                        const cantidad = await marcarMesDeudaUsuario(
                            psicologoId,
                            year,
                            month
                        );

                        if (cantidad > 0) {
                            openModal(
                                "✅ Estado revertido",
                                `Se marcaron ${cantidad} reservas como DEUDA.`
                            );
                        } else {
                            openModal(
                                "ℹ️ Sin cambios",
                                "No había reservas pagadas para este período."
                            );
                        }
                    } catch (error) {
                        console.error(error);
                        openModal(
                            "❌ Error",
                            "No se pudieron revertir los pagos del mes."
                        );
                    }
                }
            );
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 mt-24 sm:mt-70 bg-gray-50 min-h-screen">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-800 mb-8 border-b-4 border-blue-200 pb-2">
                <Home className="inline h-8 w-8 mr-3 mb-1 text-blue-600" />
                Panel de Administración
            </h1>

            {/* --- RESUMEN FINANCIERO --- */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-2xl border border-green-200">
                <h2 className="text-2xl font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center">
                        <DollarSign className="h-6 w-6 mr-2 text-green-600" />
                        Reporte Financiero del Mes
                    </span>
                    <span className="text-sm font-semibold text-blue-600">
                        {monthLabel}
                    </span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">
                    <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">
                            Consultas realizadas:
                        </p>
                        <p className="text-3xl font-extrabold text-green-700 mt-1">
                            {totalConsultasMes}
                        </p>
                    </div>

                    <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">
                            Total generado ($):
                        </p>
                        <p className="text-3xl font-extrabold text-blue-700 mt-1">
                            ${totalDineroMes.toFixed(2)}
                        </p>
                    </div>
                </div>

                <button
                    onClick={generarReporte}
                    className="text-white px-6 py-3 rounded-lg transition font-bold shadow-md bg-green-600 hover:bg-green-700 flex items-center justify-center mt-4"
                >
                    Generar Reporte Mensual
                </button>
            </div>

            {/* --- CONFIGURACIÓN --- */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-2xl border border-blue-100">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <DollarSign className="h-6 w-6 mr-2 text-green-600" /> Configuración de
                    Precios
                </h2>

                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <label className="font-semibold text-lg text-gray-600">
                        Precio Base de la Consulta ($):
                    </label>
                    <input
                        type="number"
                        value={precioConsulta}
                        onChange={(e) => setPrecioConsulta(e.target.value)}
                        className="border border-gray-300 rounded-lg p-3 w-full md:w-48 focus:ring-2 focus:ring-blue-500 transition shadow-sm text-lg"
                    />
                </div>

                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <label className="font-semibold text-lg text-gray-600">
                        Precio con Descuento (+10 reservas) ($):
                    </label>
                    <input
                        type="number"
                        value={precioDescuento}
                        onChange={(e) => setPrecioDescuento(e.target.value)}
                        className="border border-gray-300 rounded-lg p-3 w-full md:w-48 focus:ring-2 focus:ring-green-500 transition shadow-sm text-lg"
                    />
                </div>

                <button
                    onClick={handleGuardarPrecio}
                    className={`text-white px-6 py-3 rounded-lg transition font-bold shadow-md ${isSavingPrice ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                        } flex items-center justify-center`}
                >
                    {isSavingPrice ? "Guardando..." : "Guardar Precios"}
                </button>
            </div>

            {/* --- PSICÓLOGOS Y DEUDA --- */}
            <div className="mb-10 p-6 bg-white rounded-xl shadow-2xl border border-red-100">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center justify-between">
                    <span className="flex items-center">
                        <Users className="h-6 w-6 mr-2 text-red-600" />
                        Gestión de Psicólogos y Finanzas
                    </span>

                    {esMobile && (
                        <button
                            onClick={() => setExpandAll(!expandAll)}
                            className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition"
                        >
                            {expandAll ? (
                                <ChevronUp className="h-6 w-6 text-red-600" />
                            ) : (
                                <ChevronDown className="h-6 w-6 text-red-600" />
                            )}
                        </button>
                    )}
                </h2>

                {/* Mobile */}
                {esMobile ? (
                    <div className="space-y-4">
                        {psicologosOrdenados.map((p) => {
                            const deuda = parseFloat(calcularDeudaDelMes(p.id));
                            const tieneDeuda = deuda > 0;

                            return (
                                <div
                                    key={p.id}
                                    className={`p-4 rounded-xl shadow-md border ${tieneDeuda
                                        ? "bg-red-50 border-red-300"
                                        : "bg-gray-50 border-gray-200"
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {getNombreCompleto(p)}
                                        </h3>
                                        <span
                                            className={`px-2 py-1 rounded-md text-xs font-semibold ${p.rol === "admin"
                                                ? "bg-yellow-100 text-yellow-700"
                                                : p.rol === "psicologo"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-gray-200 text-gray-700"
                                                }`}
                                        >
                                            {p.rol}
                                        </span>
                                    </div>

                                    {expandAll && (
                                        <>
                                            <p className="text-sm text-gray-700">
                                                📧 {p.email}
                                                <br />📱 {p.telefono}
                                            </p>

                                            <p
                                                className={`mt-3 font-bold ${tieneDeuda
                                                    ? "text-red-700"
                                                    : "text-green-700"
                                                    }`}
                                            >
                                                Deuda del mes: ${deuda.toFixed(2)}
                                            </p>

                                            <div className="mt-3">
                                                <label className="text-gray-600 text-sm mb-1 block">
                                                    Cambiar rol:
                                                </label>
                                                <select
                                                    value={p.rol || "psicologo"}
                                                    onChange={(e) =>
                                                        handleCambiarRol(
                                                            p.id,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="w-full p-2 rounded-md border bg-white shadow-sm text-sm"
                                                >
                                                    <option value="psicologo">
                                                        Psicólogo
                                                    </option>
                                                    <option value="admin">
                                                        Admin
                                                    </option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Desktop
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse rounded-xl overflow-hidden shadow-lg">
                            <thead className="bg-red-600 text-white text-left text-sm uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Email / Teléfono</th>
                                    <th className="px-4 py-3 text-center">
                                        Deuda Total ($)
                                    </th>
                                    <th className="px-4 py-3 text-center">
                                        Rol (Cambiar)
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200">
                                {psicologosOrdenados.map((p) => {
                                    const deuda = parseFloat(
                                        calcularDeudaDelMes(p.id)
                                    );
                                    const tieneDeuda = deuda > 0;

                                    return (
                                        <tr
                                            key={p.id}
                                            className={`${tieneDeuda
                                                ? "bg-red-50 hover:bg-red-100"
                                                : "even:bg-gray-50 hover:bg-gray-100"
                                                }`}
                                        >
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {getNombreCompleto(p)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {p.email}
                                                <span className="block text-xs text-gray-500">
                                                    {p.telefono}
                                                </span>
                                            </td>
                                            <td
                                                className={`px-4 py-3 text-center text-lg ${tieneDeuda
                                                    ? "text-red-700 font-extrabold"
                                                    : "text-green-600 font-bold"
                                                    }`}
                                            >
                                                ${deuda.toFixed(2)}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <select
                                                    value={p.rol || "psicologo"}
                                                    onChange={(e) =>
                                                        handleCambiarRol(
                                                            p.id,
                                                            e.target.value
                                                        )
                                                    }
                                                    className="border-2 border-gray-300 rounded-lg p-2 w-full max-w-[150px] bg-white text-sm shadow-inner"
                                                >
                                                    <option value="psicologo">
                                                        Psicólogo
                                                    </option>
                                                    <option value="admin">
                                                        Admin
                                                    </option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- DETALLES POR PSICÓLOGO --- */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
                        <Calendar className="h-6 w-6 mr-2 text-blue-600" />
                        Detalle de Reservas
                        <span className="text-2xl font-bold text-gray-700 flex items-center">
                            {getNombreMes(monthOffset)}
                        </span>
                    </h2>

                    {/* 🔹 Filtros de mes (actual / siguiente) */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setMonthOffset(-1)}
                            className={`px-3 py-1 rounded-full text-sm font-semibold border transition ${monthOffset === -1
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                                }`}
                        >
                            Mes anterior
                        </button>
                        <button
                            type="button"
                            onClick={() => setMonthOffset(0)}
                            className={`px-3 py-1 rounded-full text-sm font-semibold border transition ${monthOffset === 0
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                                }`}
                        >
                            Mes actual
                        </button>
                        <button
                            type="button"
                            onClick={() => setMonthOffset(1)}
                            className={`px-3 py-1 rounded-full text-sm font-semibold border transition ${monthOffset === 1
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
                                }`}
                        >
                            Mes siguiente
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {psicologosOrdenados.map((p) => {
                        const reservasPsicologo = reservasPorPsicologo[p.id] || [];

                        if (reservasPsicologo.length === 0) return null;

                        const deudaTotal = calcularDeudaDelMes(p.id);
                        const tieneDeuda = parseFloat(deudaTotal) > 0;
                        const isOpen = acordeonesAbiertos[p.id];
                        const hayDeudaMes = tieneDeuda;
                        return (
                            <div
                                key={p.id}
                                className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                            >
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                        setAcordeonesAbiertos((prev) => ({
                                            ...prev,
                                            [p.id]: !prev[p.id],
                                        }))
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setAcordeonesAbiertos((prev) => ({
                                                ...prev,
                                                [p.id]: !prev[p.id],
                                            }));
                                        }
                                    }}
                                    className={`w-full flex justify-between items-center p-4 text-left ${tieneDeuda
                                        ? "bg-red-50 hover:bg-red-100 border-l-4 border-red-500"
                                        : "bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500"
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-bold text-gray-800">
                                                {getNombreCompleto(p)}
                                            </span>

                                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white font-semibold uppercase">
                                                {p.rol}
                                            </span>

                                        </div>

                                        <span
                                            className={`block text-sm font-semibold mt-1 ${tieneDeuda ? "text-red-600" : "text-green-600"
                                                }`}
                                        >
                                            Deuda Pendiente: ${deudaTotal}
                                        </span>
                                    </div>
                                    {p.rol !== "admin" && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation(); // no abrir/cerrar acordeón
                                                handlePagarMesUsuario(p.id, getNombreCompleto(p), hayDeudaMes);
                                            }}
                                            className={`ml-2 px-3 py-3 rounded-md text-xs text-white font-semibold shadow
                        ${hayDeudaMes
                                                    ? "bg-emerald-600 hover:bg-emerald-700" // 🟢 Pagar mes
                                                    : "bg-red-600 hover:bg-red-700"         // 🔴 Marcar como deuda
                                                }`}
                                        >
                                            {hayDeudaMes ? "Pagar mes" : "Marcar como deuda"}
                                        </button>
                                    )}
                                    {isOpen ? (
                                        <ChevronUp className="ml-10 h-6 w-6 text-gray-600" />
                                    ) : (
                                        <ChevronDown className="ml-10 h-6 w-6 text-gray-600" />
                                    )}
                                </div>

                                {isOpen && (
                                    <div className="p-1 bg-gray-50 border-t border-gray-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[480px] text-[12px] sm:text-xs border-collapse">
                                                <thead className="bg-gray-200 text-gray-700 uppercase">
                                                    <tr>
                                                        <th className="px-0.5 py-0.5 text-left">
                                                            Consultorio
                                                        </th>
                                                        <th className="px-0.5 py-0.5">
                                                            Fecha/Hora
                                                        </th>
                                                        <th className="px-0.5 py-0.5">
                                                            Precio ($)
                                                        </th>
                                                        <th className="px-0.5 py-0.5">
                                                            Estado
                                                        </th>
                                                        <th className="px-0.5 py-0.5">
                                                            Acciones
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-gray-100">
                                                    {reservasPsicologo.map((r) => (
                                                        <tr
                                                            key={r.id}
                                                            className={`text-center ${r.pagado
                                                                ? "bg-white"
                                                                : "bg-yellow-50"
                                                                } hover:bg-gray-100`}
                                                        >
                                                            <td className="px-1 py-2 text-left font-medium">
                                                                {r.consultorio}
                                                            </td>

                                                            <td className="px-1 py-2">
                                                                {r.fecha} - {r.horaInicio} a{" "}
                                                                {r.horaFin}
                                                            </td>

                                                            <td
                                                                className={`px-1 py-2 font-semibold ${r.pagado
                                                                    ? "text-gray-600"
                                                                    : "text-red-500"
                                                                    }`}
                                                            >
                                                                ${r.precio}
                                                            </td>

                                                            <td className="px-1 py-2 text-sm font-semibold">
                                                                {r.pagado ? (
                                                                    <span className="text-green-600 flex items-center justify-center">
                                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                                        Pagado
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-600 flex items-center justify-center">
                                                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                                                        Deuda
                                                                    </span>
                                                                )}
                                                            </td>

                                                            <td className="px-3 py-2 flex flex-col sm:flex-row justify-center gap-2">
                                                                {p.rol !== "admin" && (
                                                                    <button
                                                                        onClick={() =>
                                                                            togglePago(r)
                                                                        }
                                                                        className={`px-2 py-1 rounded-md text-white text-xs font-semibold ${r.pagado
                                                                            ? "bg-gray-500 hover:bg-gray-600"
                                                                            : "bg-green-600 hover:bg-green-700"
                                                                            }`}
                                                                    >
                                                                        {r.pagado
                                                                            ? "Marcar Deuda"
                                                                            : "Marcar Pagado"}
                                                                    </button>
                                                                )}

                                                                <button
                                                                    onClick={() =>
                                                                        handleEliminar(r.id)
                                                                    }
                                                                    className="bg-red-600 text-white px-2 py-1 rounded-md text-xs hover:bg-red-700"
                                                                >
                                                                    Eliminar 🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* MODAL */}
            {modalVisible && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-80 text-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">
                            {modalTitle}
                        </h2>
                        <p className="text-gray-700 mb-6">{modalMessage}</p>

                        <div className="flex justify-center gap-3">
                            {modalConfirm ? (
                                <>
                                    <button
                                        onClick={() => {
                                            modalConfirm();
                                            closeModal();
                                        }}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                    >
                                        Confirmar
                                    </button>
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                                    >
                                        Cancelar
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={closeModal}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Cerrar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
