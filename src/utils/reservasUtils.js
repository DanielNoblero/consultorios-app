// =============================================
// utils/reservasUtils.js
// SISTEMA COMPLETO, ACTUALIZADO Y CORREGIDO
// SOLO USA psicologoId
// =============================================

import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// =====================================================
// PRECIOS CONFIGURADOS
// =====================================================
export const getPreciosConfig = async () => {
    try {
        const ref = doc(db, "configuracion", "precioConsulta");
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            return {
                precioBase: parseFloat(data.precioBase || data.precio || 250),
                precioDescuento: parseFloat(data.precioDescuento || 230),
            };
        }
    } catch (error) {
        console.error("Error al obtener precios configurados:", error);
    }
    return { precioBase: 250, precioDescuento: 230 };
};

// =====================================================
// UTILIDADES DE FECHAS
// =====================================================
export const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

export const getSunday = (date) => {
    const lunes = getMonday(date);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return domingo;
};

// =====================================================
//  TRAER RESERVAS DEL PROFESIONAL (psicologoId)
// =====================================================
export const traerReservasUsuario = async (userId) => {
    if (!userId) return [];

    try {
        const q = query(
            collection(db, "reservas"),
            where("psicologoId", "==", userId)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs.map((d) => {
            const fechaStr = d.data().fecha;
            return {
                id: d.id,
                ...d.data(),
                fecha: fechaStr,
                fechaObj: new Date(`${fechaStr}T00:00:00`),
            };
        });
    } catch (error) {
        console.error("Error al traer reservas del usuario:", error);
        return [];
    }
};

// =====================================================
//  ACTUALIZAR PRECIO DE UNA RESERVA
// =====================================================
const updateReservationPrice = async (id, price) => {
    if (!id) return;
    try {
        await updateDoc(doc(db, "reservas", id), { precio: price });
    } catch (error) {
        console.error(`Error al actualizar precio de reserva ${id}:`, error);
    }
};

// =====================================================
//  TRAER RESERVAS DEL DÍA (para el calendario)
// =====================================================
export const traerReservas = async (fechaSeleccionada, consultorio, getIniciales) => {
    if (!fechaSeleccionada) return [];

    const y = fechaSeleccionada.getFullYear();
    const m = `${fechaSeleccionada.getMonth() + 1}`.padStart(2, "0");
    const d = `${fechaSeleccionada.getDate()}`.padStart(2, "0");
    const fecha = `${y}-${m}-${d}`;

    try {
        const q = query(
            collection(db, "reservas"),
            where("fecha", "==", fecha),
            where("consultorio", "==", consultorio)
        );

        const snap = await getDocs(q);
        if (snap.empty) return [];

        const reservas = [];
        const cache = {};

        for (let docu of snap.docs) {
            const data = docu.data();

            // 🔥 AHORA SOLO USAMOS psicologoId
            const psicologoId = data.psicologoId;
            if (!psicologoId) continue; // si por alguna razón no existe, salteamos

            if (!cache[psicologoId]) {
                const uSnap = await getDoc(doc(db, "usuarios", psicologoId));
                cache[psicologoId] = uSnap.exists()
                    ? uSnap.data()
                    : { nombre: "Desconocido", apellido: "" };
            }

            const u = cache[psicologoId];

            reservas.push({
                id: docu.id,
                ...data,
                nombre: u.nombre,
                apellido: u.apellido,
                iniciales: getIniciales(u.nombre, u.apellido),
                fechaObj: new Date(`${data.fecha}T00:00:00`),
            });
        }

        reservas.sort(
            (a, b) =>
                new Date(`${a.fecha}T${a.horaInicio}`) -
                new Date(`${b.fecha}T${b.horaInicio}`)
        );

        return reservas;
    } catch (e) {
        console.error("Error traer reservas del día:", e);
        return [];
    }
};

// =====================================================
//  HELPER: DETECTAR SI UNA RESERVA YA EXISTE (PARA EVITAR DUPLICADOS)
// =====================================================
const mismaReserva = (a, b) => {
    return (
        a.psicologoId === b.psicologoId &&
        a.fecha === b.fecha &&
        a.horaInicio === b.horaInicio &&
        a.horaFin === b.horaFin &&
        a.consultorio === b.consultorio
    );
};

const existeReservaEnLista = (lista, reserva) => {
    return lista.some((r) => mismaReserva(r, reserva));
};

// =====================================================
//  CONFIRMAR RESERVA (SOLO psicologoId, ADMIN = PRECIO 0)
// =====================================================
export const confirmarReserva = async ({
    reservaBase,
    tipoReserva,
    recurrenciaTipo,
    recurrenciaCantidad,
    psicologo,
}) => {
    if (!reservaBase || !psicologo) return;

    try {
        const { precioBase, precioDescuento } = await getPreciosConfig();

        // Perfil del psicólogo
        const snap = await getDoc(doc(db, "usuarios", psicologo.uid));
        const perfil = snap.exists() ? snap.data() : {};

        const esAdmin = perfil.rol === "admin";

        // Reservas ya existentes del psicólogo
        const existentes = await traerReservasUsuario(psicologo.uid);

        // ---------------------------------------------
        // GENERAR TODAS LAS FECHAS
        // ---------------------------------------------
        const baseDate = new Date(`${reservaBase.fecha}T00:00:00`);

        const total =
            tipoReserva === "Recurrente"
                ? recurrenciaTipo === "Mensual"
                    ? recurrenciaCantidad * 4
                    : recurrenciaTipo === "Anual"
                        ? recurrenciaCantidad * 52
                        : recurrenciaCantidad
                : 1;

        const groupId = tipoReserva === "Recurrente" ? uuidv4() : null;

        const nuevas = [];

        for (let i = 0; i < total; i++) {
            const date = new Date(baseDate);
            // Para ahora seguimos usando salto semanal (multiplicando por 7)
            date.setDate(baseDate.getDate() + i * 7);

            const fechaStr = date.toISOString().split("T")[0];

            const nuevaReserva = {
                psicologoId: psicologo.uid, // 🔥 ÚNICO ID DE VÍNCULO
                nombre: perfil.nombre || "",
                apellido: perfil.apellido || "",
                email: psicologo.email,
                fecha: fechaStr,
                fechaObj: date,
                horaInicio: reservaBase.horaInicio,
                horaFin: reservaBase.horaFin,
                consultorio: reservaBase.consultorio,
                tipo:
                    tipoReserva === "Ocasional"
                        ? "Ocasional"
                        : `Recurrente ${recurrenciaTipo}`,
                precio: null,
                pagado: false,
                groupId: groupId,
            };

            // ⚠️ ANTI-DUPLICADOS:
            // Si ya existe una reserva igual en Firestore o en las que vamos generando, NO la agregamos.
            if (
                !existeReservaEnLista(existentes, nuevaReserva) &&
                !existeReservaEnLista(nuevas, nuevaReserva)
            ) {
                nuevas.push(nuevaReserva);
            }
        }

        // Si por algún motivo no quedó ninguna nueva (todo ya existía), salimos
        if (nuevas.length === 0) {
            console.warn("No se generaron nuevas reservas porque ya existían.");
            return;
        }

        // =====================================================
        // SI ES ADMIN: TODO PRECIO = 0
        // =====================================================
        if (esAdmin) {
            nuevas.forEach((r) => (r.precio = 0));
            await Promise.all(
                nuevas.map((r) => {
                    const { fechaObj, ...rest } = r;
                    return addDoc(collection(db, "reservas"), rest);
                })
            );
            return;
        }

        // =====================================================
        // DESCUENTO POR SEMANA (10+ reservas)
        // =====================================================
        const todas = [...existentes, ...nuevas];
        const semanas = {};

        todas.forEach((r) => {
            const lunes = getMonday(r.fechaObj).toISOString().split("T")[0];
            if (!semanas[lunes]) semanas[lunes] = [];
            semanas[lunes].push(r);
        });

        Object.values(semanas).forEach((lista) => {
            const descuento = lista.length >= 10;
            lista.forEach((r) => {
                r.precio = descuento ? precioDescuento : precioBase;
            });
        });

        // Asegurar que ningún precio quede null
        nuevas.forEach((r) => {
            if (r.precio == null) r.precio = precioBase;
        });

        // GUARDAR NUEVAS
        await Promise.all(
            nuevas.map((r) => {
                const { fechaObj, ...rest } = r;
                return addDoc(collection(db, "reservas"), rest);
            })
        );

        // Actualizar precios de las reservas viejas si cambiaron
        await Promise.all(
            existentes.map((r) => updateReservationPrice(r.id, r.precio))
        );
    } catch (error) {
        console.error("ERROR confirmando reserva:", error);
    }
};

// =====================================================
// ELIMINAR RESERVAS (UNA O TODA LA SERIE)
// =====================================================
export const eliminarReserva = async (reserva, eliminarSerie = false) => {
    if (!reserva) return;

    try {
        // Si no es recurrente → borrar solo una
        if (!reserva.groupId || !eliminarSerie) {
            await deleteDoc(doc(db, "reservas", reserva.id));
            return { ok: true, tipo: "una" };
        }

        // 🔥 Si es recurrente y quiere borrar TODA la serie
        const q = query(
            collection(db, "reservas"),
            where("groupId", "==", reserva.groupId)
        );

        const snap = await getDocs(q);

        const batchDeletes = snap.docs.map((d) =>
            deleteDoc(doc(db, "reservas", d.id))
        );

        await Promise.all(batchDeletes);

        return { ok: true, tipo: "serie" };

    } catch (error) {
        console.error("Error eliminando reserva(s):", error);
        return { ok: false, error };
    }
};
