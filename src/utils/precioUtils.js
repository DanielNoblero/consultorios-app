// src/utils/precioUtils.js
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

/**
 * Obtiene el precio base desde configuracion/precioConsulta
 */
export const getPrecioBase = async () => {
  try {
    const docRef = doc(db, "configuracion", "precioConsulta");
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      // Intentamos primero precioBase, luego un posible campo viejo "precio"
      const valor = data.precioBase ?? data.precio;
      const num = parseFloat(valor);
      return Number.isNaN(num) ? 250 : num;
    }
  } catch (error) {
    console.error("Error al obtener el precio base:", error);
  }

  // Fallback por si algo falla
  return 250;
};
