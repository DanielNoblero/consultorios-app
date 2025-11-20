import React from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";

const CancelarReservaModal = ({ reserva, onClose, onCancelSuccess, showNotification }) => {
    if (!reserva) return null;

    const handleCancelar = async () => {
        try {
            await deleteDoc(doc(db, "reservas", reserva.id));
            showNotification("success", "Cancelación Exitosa", "La reserva se canceló correctamente.");
            await onCancelSuccess();
            onClose();
        } catch (error) {
            console.error("Error al cancelar la reserva:", error);
            showNotification("error", "Error", "No se pudo cancelar la reserva. Inténtalo nuevamente.");
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="bg-red-600 p-4 rounded-t-xl">
                    <h3 className="text-xl font-bold text-white">🗓️ Cancelar Reserva</h3>
                </div>

                <div className="p-6 text-gray-700">
                    <p className="mb-4">
                        ¿Seguro que deseas cancelar la reserva del{" "}
                        <strong>{reserva.fecha}</strong> en el{" "}
                        <strong>Consultorio {reserva.consultorio}</strong> de{" "}
                        <strong>
                            {reserva.horaInicio} - {reserva.horaFin}
                        </strong>
                        ?
                    </p>
                    <p className="text-sm text-gray-500">
                        Esta acción no se puede deshacer.
                    </p>
                </div>

                <div className="flex justify-end p-4 bg-gray-50 space-x-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-100"
                    >
                        Volver
                    </button>
                    <button
                        onClick={handleCancelar}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CancelarReservaModal;
