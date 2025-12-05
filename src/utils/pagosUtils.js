// utils/pagosUtils.js
import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    getDocs,
    updateDoc,
    doc,
} from "firebase/firestore";

// Devuelve el primer y último día (YYYY-MM-DD) de un mes dado
const getMonthRangeByYearMonth = (year, month) => {
    // month viene 1-12
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // último día

    const pad = (n) => String(n).padStart(2, "0");

    const startStr = `${year}-${pad(start.getMonth() + 1)}-${pad(1)}`;
    const endStr = `${year}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;

    return { startStr, endStr };
};

// ✅ Poner todas las reservas del mes como PAGADAS (pagado: true)
export const marcarMesPagadoUsuario = async (psicologoId, year, month) => {
    if (!psicologoId) return 0;

    const { startStr, endStr } = getMonthRangeByYearMonth(year, month);

    const reservasRef = collection(db, "reservas");
    const q = query(
        reservasRef,
        where("psicologoId", "==", psicologoId),
        where("fecha", ">=", startStr),
        where("fecha", "<=", endStr),
        where("pagado", "==", false)
    );

    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const updates = snap.docs.map((d) =>
        updateDoc(doc(db, "reservas", d.id), { pagado: true })
    );

    await Promise.all(updates);
    return snap.docs.length;
};

// ✅ Poner todas las reservas del mes como DEUDA (pagado: false)
export const marcarMesDeudaUsuario = async (psicologoId, year, month) => {
    if (!psicologoId) return 0;

    const { startStr, endStr } = getMonthRangeByYearMonth(year, month);

    const reservasRef = collection(db, "reservas");
    const q = query(
        reservasRef,
        where("psicologoId", "==", psicologoId),
        where("fecha", ">=", startStr),
        where("fecha", "<=", endStr),
        where("pagado", "==", true)
    );

    const snap = await getDocs(q);
    if (snap.empty) return 0;

    const updates = snap.docs.map((d) =>
        updateDoc(doc(db, "reservas", d.id), { pagado: false })
    );

    await Promise.all(updates);
    return snap.docs.length;
};
