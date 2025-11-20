import React from "react";
import { confirmarReserva } from "../utils/reservasUtils";

const ConfirmarReservaModal = ({
    reservaAConfirmar,
    tipoReserva,
    recurrenciaTipo,
    recurrenciaCantidad,
    setTipoReserva,
    setRecurrenciaTipo,
    setRecurrenciaCantidad,
    setIsReservaModalOpen,
    user,
    showNotification,
    cargarReservas,
    actualizarMisReservas, // 🔁 Nuevo parámetro opcional
}) => {
    if (!reservaAConfirmar) return null;

    const handleConfirmar = async () => {
        await confirmarReserva({
            reservaBase: reservaAConfirmar,
            tipoReserva,
            recurrenciaTipo,
            recurrenciaCantidad,
            user,
            showNotification,
            traerReservas: cargarReservas,
        });

        // 🔁 Si se pasa la función, refresca la lista de “Mis Reservas”
        if (actualizarMisReservas) await actualizarMisReservas();

        setIsReservaModalOpen(false);
    };

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="bg-blue-600 p-4 rounded-t-xl">
                    <h3 className="text-xl font-bold text-white">✅ Confirmar Reserva</h3>
                </div>

                {/* Contenido */}
                <div className="p-6 text-gray-700">
                    <p className="mb-4">
                        Vas a confirmar la reserva del{" "}
                        <strong>{reservaAConfirmar.fecha}</strong> en el{" "}
                        <strong>Consultorio {reservaAConfirmar.consultorio}</strong> de{" "}
                        {reservaAConfirmar.horaInicio} a {reservaAConfirmar.horaFin}.
                    </p>

                    {/* Tipo de reserva */}
                    <div className="mb-4">
                        <label className="block mb-2 font-bold">Tipo de Reserva:</label>
                        <div className="flex space-x-4">
                            <button
                                onClick={() => setTipoReserva("Ocasional")}
                                className={`px-4 py-2 rounded-lg transition ${tipoReserva === "Ocasional"
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                    }`}
                            >
                                Ocasional
                            </button>
                            <button
                                onClick={() => setTipoReserva("Recurrente")}
                                className={`px-4 py-2 rounded-lg transition ${tipoReserva === "Recurrente"
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                    }`}
                            >
                                Recurrente
                            </button>
                        </div>
                    </div>

                    {/* Configuración de recurrencia */}
                    {tipoReserva === "Recurrente" && (
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <label className="block mb-2 font-bold">Frecuencia:</label>
                            <div className="flex space-x-2 mb-4">
                                {["Semanal", "Mensual", "Anual"].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setRecurrenciaTipo(t);
                                            setRecurrenciaCantidad(1);
                                        }}
                                        className={`flex-1 px-3 py-1 rounded-lg transition ${recurrenciaTipo === t
                                                ? "bg-green-600 text-white"
                                                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <label className="block mb-1 font-semibold">
                                Número de repeticiones:
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={recurrenciaCantidad}
                                onChange={(e) =>
                                    setRecurrenciaCantidad(Math.max(1, parseInt(e.target.value) || 1))
                                }
                                className="border border-gray-300 rounded-lg p-2 w-full text-center"
                            />
                        </div>
                    )}
                </div>

                {/* Botones */}
                <div className="flex justify-end p-4 bg-gray-50 space-x-3 rounded-b-xl">
                    <button
                        onClick={() => setIsReservaModalOpen(false)}
                        className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-100 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmar}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmarReservaModal;
