import { db, functions, auth } from "../firebaseConfig";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

export const makeAdmin = async (email) => {
    try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("email", "==", email));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { ok: false, message: "Usuario no encontrado en Firestore." };
        }

        const userDoc = snapshot.docs[0];
        const userRef = doc(db, "usuarios", userDoc.id);

        await updateDoc(userRef, { rol: "admin" });

        const asignarRolAdmin = httpsCallable(functions, "asignarRolAdmin");
        const result = await asignarRolAdmin({ email, rol: "admin" });

        // 🔥 FIX IMPORTANTE: ahora auth funciona
        if (auth.currentUser && auth.currentUser.email === email) {
            await auth.currentUser.getIdToken(true);
        }

        return {
            ok: true,
            message: `El usuario ${email} ahora es administrador.`,
            details: result.data
        };

    } catch (error) {
        console.error("Error al asignar rol de administrador:", error);
        return { ok: false, message: "Error al asignar el rol." };
    }
};
