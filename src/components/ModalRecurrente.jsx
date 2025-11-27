import React from "react";

const ModalRecurrente = ({
    isOpen,
    onClose,
    onEliminarUna,
    onEliminarTodas,
    reserva
}) => {
    if (!isOpen || !reserva) return null;   // ⛑️ Esto evita que el overlay bloquee clics

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">

                <h3 className="text-2xl font-extrabold mb-3 text-red-600 border-b pb-2">
                    ⚠️ Eliminar Reserva Recurrente
                </h3>

                <p className="text-gray-700 mb-4">
                    Esta reserva forma parte de una serie recurrente.
                </p>

                {/* Información */}
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-sm font-medium">
                    <p>
                        🗓 {reserva.fecha} — {reserva.horaInicio} - {reserva.horaFin}
                    </p>
                    <p className="text-sky-700 mt-2">
                        Consultorio {reserva.consultorio}
                    </p>
                </div>

                {/* Botones */}
                <div className="flex flex-col gap-3 mt-6">

                    <button
                        onClick={onEliminarUna}
                        className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold shadow-md"
                    >
                        ❌ Eliminar solo esta reserva
                    </button>

                    <button
                        onClick={onEliminarTodas}
                        className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-semibold shadow-md"
                    >
                        🗑️ Eliminar toda la serie
                    </button>

                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                    >
                        Cancelar
                    </button>

                </div>

            </div>
        </div>
    );
};

export default ModalRecurrente;
