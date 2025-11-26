import React, { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    updateDoc,
    getDoc,
    setDoc,
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

const CONFIG_DOC_ID = "precioConsulta";

const Admin = () => {
    const [psicologos, setPsicologos] = useState([]);
    const [reservas, setReservas] = useState([]);

    const [precioConsulta, setPrecioConsulta] = useState(250);
    const [precioDescuento, setPrecioDescuento] = useState(230);

    const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({});
    const [expandAll, setExpandAll] = useState(false);
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [esMobile, setEsMobile] = useState(window.innerWidth < 768);

    const [totalConsultasMes, setTotalConsultasMes] = useState(0);
    const [totalDineroMes, setTotalDineroMes] = useState(0);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalTitle, setModalTitle] = useState("");
    const [modalConfirm, setModalConfirm] = useState(null);

    // Detectar mobile
    useEffect(() => {
        const handleResize = () => setEsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Fetch reservas
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "reservas"), (snapshot) => {
            setReservas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    // Fetch psicólogos
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            setPsicologos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    // Resumen mensual
    useEffect(() => {
        if (reservas.length === 0) return;

        const reservasMes = reservas.filter(r => esReservaDelMesActual(r.fecha));

        const cantidad = reservasMes.length;
        const total = reservasMes.reduce((acc, r) => acc + parseFloat(r.precio || 0), 0);

        setTotalConsultasMes(cantidad);
        setTotalDineroMes(total);
    }, [reservas]);

    // Cargar precios
    useEffect(() => {
        const fetchPrecio = async () => {
            const ref = doc(db, "configuracion", CONFIG_DOC_ID);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                setPrecioConsulta(parseFloat(data.precioBase || data.precio || 250));
                setPrecioDescuento(parseFloat(data.precioDescuento || 230));
            }
        };
        fetchPrecio();
    }, []);

    const esReservaDelMesActual = (fechaStr) => {
        const fecha = new Date(`${fechaStr}T12:00:00`);
        const now = new Date();
        return (
            fecha.getMonth() === now.getMonth() &&
            fecha.getFullYear() === now.getFullYear()
        );
    };

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
            const ref = doc(db, "configuracion", CONFIG_DOC_ID);
            await setDoc(
                ref,
                {
                    precioBase: parseFloat(precioConsulta),
                    precioDescuento: parseFloat(precioDescuento),
                },
                { merge: true }
            );
            openModal("✅ Éxito", "Precios actualizados correctamente.");
        } catch (error) {
            openModal("❌ Error", "Error al actualizar los precios.");
        } finally {
            setIsSavingPrice(false);
        }
    };

    const handleCambiarRol = async (psicologoId, nuevoRol) => {
        const psicologo = psicologos.find((p) => p.id === psicologoId);
        openModal(
            "Cambiar Rol",
            `¿Seguro que quieres cambiar el rol de ${psicologo?.nombre || "este psicólogo"} a ${nuevoRol}?`,
            async () => {
                try {
                    const ref = doc(db, "usuarios", psicologoId);
                    await updateDoc(ref, { rol: nuevoRol });
                    openModal("✅ Éxito", "Rol actualizado correctamente");
                } catch (error) {
                    openModal("❌ Error", "Error al actualizar el rol.");
                }
            }
        );
    };

    // 🔥 AHORA SOLO COMPARA CONTRA psicologoId
    const calcularDeudaDelMes = (psicologoId) =>
        reservas
            .filter(
                (r) =>
                    r.psicologoId === psicologoId &&
                    !r.pagado &&
                    esReservaDelMesActual(r.fecha)
            )
            .reduce((acc, r) => acc + parseFloat(r.precio || 0), 0)
            .toFixed(2);

    const handleEliminar = async (id) => {
        openModal("Eliminar Reserva", "¿Seguro que deseas eliminar esta reserva?", async () => {
            try {
                await deleteDoc(doc(db, "reservas", id));
                openModal("🗑️ Eliminada", "Reserva eliminada correctamente.");
            } catch (error) {
                openModal("❌ Error", "Error al eliminar la reserva.");
            }
        });
    };

    const generarReporte = async () => {
        const url = "https://us-central1-consultorio-4e6c5.cloudfunctions.net/generarReporteManual";
        const response = await fetch(url);
        const blob = await response.blob();

        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = "reporte-mensual.xlsx";
        link.click();
    };

    const togglePago = async (reserva) => {
        try {
            const ref = doc(db, "reservas", reserva.id);
            await updateDoc(ref, { pagado: !reserva.pagado });
            openModal("✅ Actualizado", "Estado de pago actualizado.");
        } catch (error) {
            openModal("❌ Error", "Error al actualizar estado de pago.");
        }
    };

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

    const psicologosOrdenados = [...psicologos].sort((a, b) => {
        if (a.rol === "admin") return -1;
        if (b.rol === "admin") return 1;
        if (a.rol === "psicologo") return -1;
        if (b.rol === "psicologo") return 1;
        return 0;
    });

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 mt-24 sm:mt-70 bg-gray-50 min-h-screen">

            <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-800 mb-8 border-b-4 border-blue-200 pb-2">
                <Home className="inline h-8 w-8 mr-3 mb-1 text-blue-600" />
                Panel de Administración
            </h1>

            {/* --- RESUMEN FINANCIERO --- */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-2xl border border-green-200">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <DollarSign className="h-6 w-6 mr-2 text-green-600" />
                    Reporte Financiero del Mes
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">Consultas realizadas:</p>
                        <p className="text-3xl font-extrabold text-green-700 mt-1">{totalConsultasMes}</p>
                    </div>

                    <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">Total generado ($):</p>
                        <p className="text-3xl font-extrabold text-blue-700 mt-1">${totalDineroMes.toFixed(2)}</p>
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
                    <DollarSign className="h-6 w-6 mr-2 text-green-600" /> Configuración de Precios
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
                                    className={`p-4 rounded-xl shadow-md border ${tieneDeuda ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-lg font-bold text-gray-900">{p.nombre}</h3>
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
                                                className={`mt-3 font-bold ${tieneDeuda ? "text-red-700" : "text-green-700"
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
                                                        handleCambiarRol(p.id, e.target.value)
                                                    }
                                                    className="w-full p-2 rounded-md border bg-white shadow-sm text-sm"
                                                >
                                                    <option value="psicologo">Psicólogo</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Desktop table
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse rounded-xl overflow-hidden shadow-lg">
                            <thead className="bg-red-600 text-white text-left text-sm uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Email / Teléfono</th>
                                    <th className="px-4 py-3 text-center">Deuda Total ($)</th>
                                    <th className="px-4 py-3 text-center">Rol (Cambiar)</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-200">
                                {psicologosOrdenados.map((p) => {
                                    const deuda = parseFloat(calcularDeudaDelMes(p.id));
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
                                                {p.nombre || "Psicólogo sin nombre"}
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
                                                    onChange={(e) => handleCambiarRol(p.id, e.target.value)}
                                                    className="border-2 border-gray-300 rounded-lg p-2 w-full max-w-[150px] bg-white text-sm shadow-inner"
                                                >
                                                    <option value="psicologo">Psicólogo</option>
                                                    <option value="admin">Admin</option>
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
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <Calendar className="h-6 w-6 mr-2 text-blue-600" />
                    Detalle de Reservas
                </h2>

                <div className="space-y-4">
                    {psicologosOrdenados.map((p) => {
                        // 🔥 SOLO psicologoId
                        let reservasPsicologo = reservas
                            .filter((r) => r.psicologoId === p.id)
                            .filter((r) => esReservaDelMesActual(r.fecha));

                        reservasPsicologo.sort((a, b) => {
                            const dateA = new Date(`${a.fecha}T${a.horaInicio}`);
                            const dateB = new Date(`${b.fecha}T${b.horaInicio}`);

                            return dateA - dateB;
                        });

                        if (reservasPsicologo.length === 0) return null;

                        const deudaTotal = calcularDeudaDelMes(p.id);
                        const tieneDeuda = parseFloat(deudaTotal) > 0;
                        const isOpen = acordeonesAbiertos[p.id];

                        return (
                            <div
                                key={p.id}
                                className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                            >
                                <button
                                    onClick={() =>
                                        setAcordeonesAbiertos((prev) => ({
                                            ...prev,
                                            [p.id]: !prev[p.id],
                                        }))
                                    }
                                    className={`w-full flex justify-between items-center p-4 text-left ${tieneDeuda
                                        ? "bg-red-50 hover:bg-red-100 border-l-4 border-red-500"
                                        : "bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500"
                                        }`}
                                >
                                    <div>
                                        <span className="text-lg font-bold text-gray-800 flex items-center">
                                            {p.nombre || "Psicólogo sin nombre"}
                                            <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white font-semibold uppercase">
                                                {p.rol}
                                            </span>
                                        </span>

                                        <span
                                            className={`block text-sm font-semibold mt-1 ${tieneDeuda ? "text-red-600" : "text-green-600"
                                                }`}
                                        >
                                            Deuda Pendiente: ${deudaTotal}
                                        </span>
                                    </div>

                                    {isOpen ? (
                                        <ChevronUp className="h-6 w-6 text-gray-600" />
                                    ) : (
                                        <ChevronDown className="h-6 w-6 text-gray-600" />
                                    )}
                                </button>

                                {isOpen && (
                                    <div className="p-1 bg-gray-50 border-t border-gray-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[480px] text-[12px] sm:text-xs border-collapse">
                                                <thead className="bg-gray-200 text-gray-700 uppercase">
                                                    <tr>
                                                        <th className="px-0.5 py-0.5 text-left">
                                                            Consultorio
                                                        </th>
                                                        <th className="px-0.5 py-0.5">Fecha/Hora</th>
                                                        <th className="px-0.5 py-0.5">Precio ($)</th>
                                                        <th className="px-0.5 py-0.5">Estado</th>
                                                        <th className="px-0.5 py-0.5">Acciones</th>
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
                                                                {r.fecha} - {r.horaInicio} a {r.horaFin}
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

                                                                {/* Solo ocultamos opciones de pago si el psicólogo es admin */}
                                                                {p.rol !== "admin" && (
                                                                    <button
                                                                        onClick={() => togglePago(r)}
                                                                        className={`px-2 py-1 rounded-md text-white text-xs font-semibold ${r.pagado
                                                                                ? "bg-gray-500 hover:bg-gray-600"
                                                                                : "bg-green-600 hover:bg-green-700"
                                                                            }`}
                                                                    >
                                                                        {r.pagado ? "Marcar Deuda" : "Marcar Pagado"}
                                                                    </button>
                                                                )}

                                                                {/* 🔥 Eliminar siempre visible para todos (incluido admin) */}
                                                                <button
                                                                    onClick={() => handleEliminar(r.id)}
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
