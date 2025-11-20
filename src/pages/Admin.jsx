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
    const [usuarios, setUsuarios] = useState([]);
    const [reservas, setReservas] = useState([]);
    const [precioConsulta, setPrecioConsulta] = useState(250);
    const [precioDescuento, setPrecioDescuento] = useState(230); // ✅ Nuevo campo
    const [acordeonesAbiertos, setAcordeonesAbiertos] = useState({});
    const [isSavingPrice, setIsSavingPrice] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    //Resunmen del mes actual plata
    const [totalConsultasMes, setTotalConsultasMes] = useState(0);
    const [totalDineroMes, setTotalDineroMes] = useState(0);

    // Estados para el modal
    const [modalVisible, setModalVisible] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const [modalTitle, setModalTitle] = useState("");
    const [modalConfirm, setModalConfirm] = useState(null);

    // --- FETCH RESERVAS ---
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "reservas"), (snapshot) => {
            setReservas(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    // --- FETCH USUARIOS ---
    useEffect(() => {
        const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
            setUsuarios(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    // cálculo del reporte mensual
    useEffect(() => {
        if (reservas.length === 0) return;

        const reservasMes = reservas.filter(r => esReservaDelMesActual(r.fecha));

        const cantidad = reservasMes.length;

        const total = reservasMes.reduce(
            (acc, r) => acc + parseFloat(r.precio || 0),
            0
        );

        setTotalConsultasMes(cantidad);
        setTotalDineroMes(total);
    }, [reservas]);

    // --- FETCH PRECIOS CONFIGURADOS ---
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

    // --- MODAL FUNCIONES ---
    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalConfirm(() => confirmAction);
        setModalVisible(true);
    };

    /**
     * Comprueba si la reserva es del mes actual.
     * @param {string} fechaStr La fecha de la reserva en formato 'YYYY-MM-DD'.
     */
    const esReservaDelMesActual = (fechaStr) => {
        // Usamos una hora al final para una construcción de Date más robusta, aunque solo compare mes/año
        const fecha = new Date(`${fechaStr}T12:00:00`); 
        const now = new Date();
        return (
            fecha.getMonth() === now.getMonth() &&
            fecha.getFullYear() === now.getFullYear()
        );
    };

    const closeModal = () => {
        setModalVisible(false);
        setModalMessage("");
        setModalConfirm(null);
    };

    // --- GUARDAR PRECIOS ---
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
            console.error(error);
            openModal("❌ Error", "Error al actualizar los precios.");
        } finally {
            setIsSavingPrice(false);
        }
    };

    // --- CAMBIAR ROL ---
    const handleCambiarRol = async (usuarioId, nuevoRol) => {
        const usuario = usuarios.find((u) => u.id === usuarioId);
        openModal(
            "Cambiar Rol",
            `¿Seguro que quieres cambiar el rol de ${usuario?.nombre || "este usuario"
            } a ${nuevoRol}?`,
            async () => {
                try {
                    const usuarioRef = doc(db, "usuarios", usuarioId);
                    await updateDoc(usuarioRef, { rol: nuevoRol });
                    openModal("✅ Éxito", "Rol actualizado correctamente");
                } catch (error) {
                    console.error(error);
                    openModal("❌ Error", "Hubo un error al actualizar el rol.");
                }
            }
        );
    };

    // --- CALCULAR DEUDA ---
    const calcularDeudaDelMes = (usuarioId) =>
        reservas
            .filter(
                (r) =>
                    (r.usuarioId === usuarioId || r.userId === usuarioId) &&
                    !r.pagado &&
                    esReservaDelMesActual(r.fecha)
            )
            .reduce((acc, r) => acc + parseFloat(r.precio || 0), 0)
            .toFixed(2);

    // --- ELIMINAR RESERVA ---
    const handleEliminar = async (id) => {
        openModal("Eliminar Reserva", "¿Seguro que deseas eliminar esta reserva?", async () => {
            try {
                await deleteDoc(doc(db, "reservas", id));
                openModal("🗑️ Eliminada", "Reserva eliminada correctamente.");
            } catch (error) {
                console.error(error);
                openModal("❌ Error", "Error al eliminar la reserva.");
            }
        });
    };
    // Generar Reporte Mensual
    const generarReporte = async () => {
        const url = "https://us-central1-consultorio-4e6c5.cloudfunctions.net/generarReporteManual";

        const response = await fetch(url);
        const blob = await response.blob();

        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = "reporte-mensual.xlsx";
        link.click();
    };

    // --- CAMBIAR ESTADO DE PAGO ---
    const togglePago = async (reserva) => {
        try {
            const ref = doc(db, "reservas", reserva.id);
            await updateDoc(ref, { pagado: !reserva.pagado });
            openModal("✅ Actualizado", "El estado de pago se cambió correctamente.");
        } catch (error) {
            console.error(error);
            openModal("❌ Error", "Error al actualizar el estado de pago.");
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

    const usuariosOrdenados = [...usuarios].sort((a, b) => {
        if (a.rol === "admin") return -1;
        if (b.rol === "admin") return 1;
        if (a.rol === "psicologo") return -1;
        if (b.rol === "psicologo") return 1;
        return 0;
    });

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 mt-24 sm:mt-70 bg-gray-50 min-h-screen">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-blue-800 mb-8 border-b-4 border-blue-200 pb-2">
                <Home className="inline h-8 w-8 mr-3 mb-1 text-blue-600" /> Panel de
                Administración
            </h1>
            {/* RESUMEN FINANCIERO DEL MES */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-2xl border border-green-200">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <DollarSign className="h-6 w-6 mr-2 text-green-600" />
                    Reporte Financiero del Mes
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">Consultas realizadas:</p>
                        <p className="text-3xl font-extrabold text-green-700 mt-1">
                            {totalConsultasMes}
                        </p>
                    </div>
                    <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg shadow-sm">
                        <p className="text-lg font-semibold text-gray-700">Total generado ($):</p>
                        <p className="text-3xl font-extrabold text-blue-700 mt-1">
                            ${totalDineroMes.toFixed(2)}
                        </p>
                    </div>
                    
                </div>

                <p className="text-sm text-gray-500 mt-4">* Cálculo automático en tiempo real.</p>
                <button onClick={generarReporte} className="text-white px-6 py-3 rounded-lg transition font-bold shadow-md md:ml-4 bg-green-600 hover:bg-green-700 flex items-center justify-center mt-4">
                        Generar Reporte Mensual
                    </button>
            </div>
            
            {/* --- SECCIÓN: CONFIGURACIÓN GENERAL --- */}
            <div className="mb-8 p-6 bg-white rounded-xl shadow-2xl border border-blue-100">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <DollarSign className="h-6 w-6 mr-2 text-green-600" /> Configuración de
                    Precios
                </h2>

                {/* ✅ Campo de precio base */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <label className="font-semibold text-lg text-gray-600">
                        Precio Base de la Consulta ($):
                    </label>
                    <input
                        type="number"
                        value={precioConsulta}
                        onChange={(e) => setPrecioConsulta(e.target.value)}
                        className="border border-gray-300 rounded-lg p-3 w-full md:w-48 focus:ring-2 focus:ring-blue-500 transition shadow-sm text-lg"
                        placeholder="Ej: 300.00"
                        disabled={isSavingPrice}
                    />
                </div>

                {/* ✅ Campo de precio con descuento */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                    <label className="font-semibold text-lg text-gray-600">
                        Precio con Descuento (+10 reservas) ($):
                    </label>
                    <input
                        type="number"
                        value={precioDescuento}
                        onChange={(e) => setPrecioDescuento(e.target.value)}
                        className="border border-gray-300 rounded-lg p-3 w-full md:w-48 focus:ring-2 focus:ring-green-500 transition shadow-sm text-lg"
                        placeholder="Ej: 230.00"
                        disabled={isSavingPrice}
                    />
                </div>

                <button
                    onClick={handleGuardarPrecio}
                    className={`text-white px-6 py-3 rounded-lg transition font-bold shadow-md md:ml-4 ${isSavingPrice
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                        } flex items-center justify-center`}
                    disabled={isSavingPrice}
                >
                    {isSavingPrice ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    ) : (
                        <CheckCircle className="h-5 w-5 mr-2" />
                    )}
                    {isSavingPrice ? "Guardando..." : "Guardar Precios"}
                </button>

            </div>

            {/* --- SECCIÓN: USUARIOS Y DEUDA --- */}
            <div className="mb-10 p-6 bg-white rounded-xl shadow-2xl border border-red-100">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <Users className="h-6 w-6 mr-2 text-red-600" /> Gestión de Profesionales y Finanzas
                </h2>
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
                            {usuariosOrdenados.map(u => {
                                const deuda = parseFloat(calcularDeudaDelMes(u.id));
                                const tieneDeuda = deuda > 0;
                                const rowClass = tieneDeuda
                                    ? "bg-red-50 hover:bg-red-100"
                                    : "even:bg-gray-50 hover:bg-gray-100";
                                const rolColor =
                                    u.rol === "admin"
                                        ? "text-yellow-600 font-extrabold"
                                        : u.rol === "psicologo"
                                            ? "text-blue-600 font-semibold"
                                            : "text-gray-500";

                                return (
                                    <tr key={u.id} className={rowClass}>
                                        <td className="px-4 py-3 font-medium text-gray-900">{u.nombre || "N/A"}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {u.email}
                                            <span className="block text-xs text-gray-500">{u.telefono}</span>
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
                                                value={u.rol || "usuario"}
                                                onChange={e => handleCambiarRol(u.id, e.target.value)}
                                                className={`border-2 border-gray-300 rounded-lg p-2 w-full max-w-[150px] bg-white text-sm shadow-inner ${rolColor}`}
                                            >
                                                <option value="psicologo">Psicólogo</option>
                                                <option value="admin">Admin</option>
                                                <option value="usuario">Usuario</option>
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- SECCIÓN: DETALLE DE RESERVAS --- */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-700 mb-4 flex items-center">
                    <Calendar className="h-6 w-6 mr-2 text-blue-600" /> Detalle de Reservas
                </h2>
                <div className="space-y-4">
                    {usuariosOrdenados.map(usuario => {
                        let reservasUsuario = reservas
                            .filter(r => r.usuarioId === usuario.id || r.userId === usuario.id)
                            .filter(r => esReservaDelMesActual(r.fecha));
                        
                        // ✅ Lógica de ordenamiento: Por fecha (ascendente) y luego por hora de inicio (ascendente)
                        reservasUsuario.sort((a, b) => {
                            const dateA = new Date(`${a.fecha}T${a.horaInicio}`);
                            const dateB = new Date(`${b.fecha}T${b.horaInicio}`);

                            if (isNaN(dateA) || isNaN(dateB)) {
                                // Fallback para fechas inválidas, ordenar por fecha string y hora string
                                if (a.fecha !== b.fecha) {
                                    return a.fecha.localeCompare(b.fecha);
                                }
                                return a.horaInicio.localeCompare(b.horaInicio);
                            }
                            
                            return dateA.getTime() - dateB.getTime();
                        });

                        if (reservasUsuario.length === 0) return null;

                        const deudaTotal = calcularDeudaDelMes(usuario.id);
                        const tieneDeuda = parseFloat(deudaTotal) > 0;
                        const isOpen = acordeonesAbiertos[usuario.id];

                        return (
                            <div
                                key={usuario.id}
                                className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
                            >
                                <button
                                    onClick={() =>
                                        setAcordeonesAbiertos(prev => ({
                                            ...prev,
                                            [usuario.id]: !prev[usuario.id],
                                        }))
                                    }
                                    className={`w-full flex justify-between items-center p-4 text-left ${tieneDeuda
                                        ? "bg-red-50 hover:bg-red-100 border-l-4 border-red-500"
                                        : "bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500"
                                        }`}
                                >
                                    <div>
                                        <span className="text-lg font-bold text-gray-800 flex items-center">
                                            {usuario.nombre || "Usuario sin nombre"}
                                            <span className="ml-3 px-2 py-0.5 text-xs rounded-full bg-blue-600 text-white font-semibold uppercase">
                                                {usuario.rol || "Usuario"}
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
                                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[600px] text-xs sm:text-sm border-collapse">
                                                <thead className="bg-gray-200 text-gray-700 uppercase">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Consultorio</th>
                                                        <th className="px-3 py-2">Fecha/Hora</th>
                                                        <th className="px-3 py-2">Precio ($)</th>
                                                        <th className="px-3 py-2">Estado</th>
                                                        <th className="px-3 py-2">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {reservasUsuario.map(r => (
                                                        <tr
                                                            key={r.id}
                                                            className={`text-center ${r.pagado ? "bg-white" : "bg-yellow-50"
                                                                } hover:bg-gray-100`}
                                                        >
                                                            <td className="px-3 py-2 text-left font-medium">
                                                                {r.consultorio}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                {r.fecha} - {r.horaInicio} a {r.horaFin}
                                                            </td>
                                                            <td
                                                                className={`px-3 py-2 font-semibold ${r.pagado ? "text-gray-600" : "text-red-500"
                                                                    }`}
                                                            >
                                                                ${r.precio}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm font-semibold">
                                                                {r.pagado ? (
                                                                    <span className="text-green-600 flex items-center justify-center">
                                                                        <CheckCircle className="h-4 w-4 mr-1" /> Pagado
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-600 flex items-center justify-center">
                                                                        <AlertTriangle className="h-4 w-4 mr-1" /> Deuda
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 flex flex-col sm:flex-row justify-center gap-2">
                                                                <button
                                                                    onClick={() => togglePago(r)}
                                                                    className={`px-2 py-1 rounded-md text-white text-xs font-semibold ${r.pagado
                                                                        ? "bg-gray-500 hover:bg-gray-600"
                                                                        : "bg-green-600 hover:bg-green-700"
                                                                        }`}
                                                                >
                                                                    {r.pagado ? "Marcar Deuda" : "Marcar Pagado"}
                                                                </button>
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

            {/* 🔹 MODAL GLOBAL 🔹 */}
            {modalVisible && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-80 text-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">{modalTitle}</h2>
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