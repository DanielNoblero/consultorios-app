import React, { useState } from "react";
import { confirmarReserva } from "../utils/reservasUtils";

const ConfirmarReservaModal = ({
    reservaAConfirmar,
    setIsReservaModalOpen,
    user,
    showNotification,
    cargarReservas,
    actualizarMisReservas,
}) => {

    if (!reservaAConfirmar) return null;

    // ---------------------------------------------------------
    // 🔥 ESTADO INTERNO — OPCIÓN D (NO VIENE DE PROPS)
    // ---------------------------------------------------------
    const [tipoReserva, setTipoReserva] = useState("Ocasional");
    const [recurrenciaTipo, setRecurrenciaTipo] = useState("Semanal");
    const [recurrenciaCantidad, setRecurrenciaCantidad] = useState(1);

    const cerrar = () => setIsReservaModalOpen(false);

    const confirmar = async () => {
        try {
            await confirmarReserva({
                reservaBase: reservaAConfirmar,
                tipoReserva,
                recurrenciaTipo,
                recurrenciaCantidad,
                psicologo: user,
            });

            showNotification(
                "success",
                "Reserva creada",
                "La reserva fue registrada correctamente."
            );

            cerrar();
            await cargarReservas();
            await actualizarMisReservas();
        } catch (error) {
            console.error(error);
            showNotification(
                "error",
                "Error",
                "Ocurrió un problema al confirmar la reserva."
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-2xl border border-gray-200 animate-slideUp">

                <h2 className="text-2xl font-extrabold text-blue-800 text-center mb-6 tracking-wide">
                    Confirmar Reserva
                </h2>

                {/* INFO PRINCIPAL */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6 space-y-2">
                    <p><strong>Fecha:</strong> {reservaAConfirmar.fecha}</p>
                    <p>
                        <strong>Horario:</strong>{" "}
                        {reservaAConfirmar.horaInicio} - {reservaAConfirmar.horaFin}
                    </p>
                    <p><strong>Consultorio:</strong> {reservaAConfirmar.consultorio}</p>
                </div>

                {/* TIPO DE RESERVA */}
                <div className="font-semibold text-gray-700">
                    <label className="font-semibold">Tipo de reserva</label>
                    <select
                        className="w-full mt-1 p-3 border rounded-lg bg-gray-100 focus:ring-2 focus:ring-blue-400"
                        value={tipoReserva}
                        onChange={(e) => setTipoReserva(e.target.value)}
                    >
                        <option value="Ocasional">Ocasional</option>
                        <option value="Recurrente">Recurrente</option>
                    </select>
                </div>

                {/* OPCIONES SOLO SI ES RECURRENTE */}
                {tipoReserva === "Recurrente" && (
                    <div className="space-y-4">

                        <div>
                            <label className="font-semibold">Recurrencia</label>
                            <select
                                className="w-full mt-1 p-2 border rounded-lg"
                                value={recurrenciaTipo}
                                onChange={(e) => setRecurrenciaTipo(e.target.value)}
                            >
                                <option value="Semanal">Semanal</option>
                                <option value="Mensual">Mensual</option>
                                <option value="Anual">Anual</option>
                            </select>
                        </div>

                        <div>
                            <label className="font-semibold">Cantidad</label>
                            <input
                                type="number"
                                className="w-full mt-1 p-2 border rounded-lg"
                                min={1}
                                value={recurrenciaCantidad}
                                onChange={(e) =>
                                    setRecurrenciaCantidad(Number(e.target.value))
                                }
                            />
                        </div>

                    </div>
                )}

                {/* BOTONES */}
                <div className="flex justify-between mt-8">
                    <button
                        onClick={cerrar}
                        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 
                                    text-gray-700 font-semibold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={confirmar}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 
                                    text-white font-bold shadow-md transition"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmarReservaModal;
