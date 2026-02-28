import { useEffect, useState } from "react";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function useCambioPrecio() {
    const [mostrarModal, setMostrarModal] = useState(false);
    const [precioData, setPrecioData] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;

            try {
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (!userSnap.exists()) return;

                const userData = userSnap.data();

                if (userData.rol !== "psicologo") return;

                const configSnap = await getDoc(
                    doc(db, "configuracion", "precioConsulta")
                );
                if (!configSnap.exists()) return;

                const config = configSnap.data();

                if (!config.fechaCambio) return;

                if (userData.precioVisto !== config.fechaCambio) {
                    setPrecioData(config);
                    setMostrarModal(true);
                }
            } catch (error) {
                console.error("Error verificando cambio de precio:", error);
            }
        });

        return () => unsubscribe();
    }, []);

    const aceptarCambio = async () => {
        const user = auth.currentUser;
        if (!user || !precioData) return;

        await updateDoc(doc(db, "usuarios", user.uid), {
            precioVisto: precioData.fechaCambio,
        });

        setMostrarModal(false);
    };

    return {
        mostrarModal,
        precioData,
        aceptarCambio,
    };
}