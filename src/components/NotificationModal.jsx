import React from "react";

const NotificationModal = ({ isOpen, type, title, message, onClose }) => {
    if (!isOpen) return null;

    const config = {
        success: "bg-green-600",
        error: "bg-red-600",
        warning: "bg-yellow-500",
        info: "bg-blue-600",
    };

    const color = config[type] || config.info;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-80 overflow-hidden">
                <div className={`${color} p-4`}>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                </div>
                <div className="p-4 text-gray-700">
                    <p dangerouslySetInnerHTML={{ __html: message }} />
                </div>
                <div className="p-3 flex justify-end bg-gray-50">
                    <button
                        onClick={onClose}
                        className={`${color} text-white px-4 py-2 rounded-lg font-medium hover:opacity-90`}
                    >
                        Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotificationModal;
