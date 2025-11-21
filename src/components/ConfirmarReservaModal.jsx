// src/components/ConfirmarReservaModal.jsx
import React, { useState } from "react";
import { confirmarReserva } from "../utils/reservasUtils";
import {
    CalendarDays,
    Clock,
    Building2
} from "lucide-react";

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
    actualizarMisReservas
}) => {

    const [loading, setLoading] = useState(false);

    if (!reservaAConfirmar) return null;

    const handleConfirmar = async () => {
        try {
            setLoading(true);

            await confirmarReserva({
                reservaBase: reservaAConfirmar,
                tipoReserva,
                recurrenciaTipo,
                recurrenciaCantidad,
                user,
                traerReservas: cargarReservas,
            });

            await actualizarMisReservas?.();

            showNotification(
                "success",
                "Reserva Confirmada",
                tipoReserva === "Ocasional"
                    ? "Tu reserva ha sido registrada."
                    : "Tus reservas recurrentes han sido creadas correctamente."
            );

            setIsReservaModalOpen(false);

        } catch (error) {
            console.error("Error confirmando reserva:", error);
            showNotification(
                "error",
                "Error",
                "Ocurrió un problema al confirmar la reserva."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">

            <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 animate-slideUp">

                {/* HEADER */}
                <h2 className="text-2xl font-extrabold text-blue-800 text-center mb-6 tracking-wide">
                    Confirmar Reserva
                </h2>

                {/* INFO BOX */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 space-y-2">
                    <div className="flex items-center gap-2 text-gray-700">
                        <CalendarDays size={20} className="text-blue-600" />
                        <span><strong>Fecha:</strong> {reservaAConfirmar.fecha}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                        <Clock size={20} className="text-blue-600" />
                        <span><strong>Horario:</strong> {reservaAConfirmar.horaInicio} - {reservaAConfirmar.horaFin}</span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-700">
                        <Building2 size={20} className="text-blue-600" />
                        <span><strong>Consultorio:</strong> {reservaAConfirmar.consultorio}</span>
                    </div>
                </div>

                {/* SELECT TIPO */}
                <label className="font-semibold text-gray-700">Tipo de reserva</label>
                <select
                    value={tipoReserva}
                    onChange={(e) => setTipoReserva(e.target.value)}
                    className="w-full mt-1 p-3 border rounded-lg bg-gray-100 focus:ring-2 focus:ring-blue-400"
                >
                    <option value="Ocasional">Ocasional (1 reserva)</option>
                    <option value="Recurrente">Recurrente</option>
                </select>

                {/* RECURRENCIA */}
                {tipoReserva === "Recurrente" && (
                    <>
                        <div className="mt-5">
                            <label className="font-semibold text-gray-700">Frecuencia</label>
                            <select
                                value={recurrenciaTipo}
                                onChange={(e) => setRecurrenciaTipo(e.target.value)}
                                className="w-full mt-1 p-3 border rounded-lg bg-gray-100 focus:ring-2 focus:ring-blue-400"
                            >
                                <option value="Semanal">Semanal</option>
                                <option value="Mensual">Mensual</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </div>

                        <div className="mt-4">
                            <label className="font-semibold text-gray-700">Cantidad</label>
                            <input
                                type="number"
                                min="1"
                                value={recurrenciaCantidad}
                                onChange={(e) => setRecurrenciaCantidad(Number(e.target.value))}
                                className="w-full mt-1 p-3 border rounded-lg bg-gray-100 focus:ring-2 focus:ring-blue-400"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Semanal = ×1 · Mensual = ×4 · Anual = ×52
                            </p>
                        </div>
                    </>
                )}

                {/* BOTONES */}
                <div className="flex justify-between mt-8">

                    <button
                        onClick={() => setIsReservaModalOpen(false)}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 
                                   text-gray-700 font-semibold transition"
                        disabled={loading}
                    >
                        Cancelar
                    </button>

                    <button
                        onClick={handleConfirmar}
                        disabled={loading}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
                                   text-white font-bold shadow-md transition"
                    >
                        {loading ? "Confirmando..." : "Confirmar"}
                    </button>

                </div>

            </div>

        </div>
    );
};

export default ConfirmarReservaModal;
