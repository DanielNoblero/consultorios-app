import { useEffect } from "react";
import "../index.css";

function PriceUpdateModal({ precioBase, precioDescuento, fechaCambio, onAccept }) {

  // 🔒 Bloquear scroll mientras esté visible
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="campana">🔔</div>
        <h2>Cambios en los precios de las consultas</h2>

        <p className="fecha">
          Vigente desde: {fechaCambio}
        </p>

        <div className="precios">
          <p><strong>Precio por hora:</strong> ${precioBase}</p>
          <p><strong>Precio bonificado:</strong> ${precioDescuento}</p>
        </div>

        <button onClick={onAccept}>
          Aceptar y continuar
        </button>
      </div>
    </div>
  );
}

export default PriceUpdateModal;