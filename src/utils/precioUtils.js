// src/utils/precioUtils.js
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

export const getPreciosConfig = async () => {
  try {
    const docRef = doc(db, "configuracion", "precioConsulta");
    const snapshot = await getDoc(docRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      return {
        precioBase: parseFloat(data.precioBase ?? 270),
        precioDescuento: parseFloat(data.precioDescuento ?? 250),
        fechaCambio: data.fechaCambio ?? "1900-01-01"
      };
    }
  } catch (error) {
    console.error("Error al obtener precios:", error);
  }

  return {
    precioBase: 270,
    precioDescuento: 250,
    fechaCambio: "1900-01-01"
  };
};