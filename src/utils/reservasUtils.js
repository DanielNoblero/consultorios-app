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
    deleteDoc,
    serverTimestamp,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { getFunctions, httpsCallable } from "firebase/functions";
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
//  ❌ SIN LECTURAS A /usuarios → SOLO USA CAMPOS DE LA RESERVA
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

        const reservas = snap.docs.map((docu) => {
            const data = docu.data();

            const nombre = data.nombre || "";
            const apellido = data.apellido || "";

            return {
                id: docu.id,
                ...data,
                nombre,
                apellido,
                iniciales: getIniciales(nombre, apellido),
                fechaObj: new Date(`${data.fecha}T00:00:00`),
            };
        });

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
export const eliminarReserva = async (
    reserva,
    eliminarSerie = false,
    user
) => {
    if (!reserva || !user) return;

    try {
        // ---------------------------------------------
        // BORRAR UNA SOLA
        // ---------------------------------------------
        if (!reserva.groupId || !eliminarSerie) {
            await backupReserva(reserva, user);
            await deleteDoc(doc(db, "reservas", reserva.id));
            return { ok: true, tipo: "una" };
        }

       // ---------------------------------------------
// BORRAR SERIE → SOLO FUTURAS (CORREGIDO)
// ---------------------------------------------
const q = query(
    collection(db, "reservas"),
    where("groupId", "==", reserva.groupId)
);

const snap = await getDocs(q);

const fechaBase = new Date(`${reserva.fecha}T00:00:00`);

const futuras = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => {
        const fechaReserva = new Date(`${r.fecha}T00:00:00`);
        return fechaReserva >= fechaBase;
    });

if (futuras.length === 0) {
    console.warn("No se encontraron reservas futuras para borrar");
    return { ok: false, motivo: "sin-reservas-futuras" };
}

// 🔐 BACKUP
await Promise.all(
    futuras.map(r => backupReserva(r, user))
);

// ❌ BORRADO
await Promise.all(
    futuras.map(r =>
        deleteDoc(doc(db, "reservas", r.id))
    )
);

return {
    ok: true,
    tipo: "serie-futura",
    cantidad: futuras.length
};

} catch (error) {
    console.error("Error eliminando reserva(s):", error);
    return { ok: false, error };
}
};

// ---------------------------------------------
// FUNCIÓN HELPER → GUARDAR BACKUP
// ---------------------------------------------
const backupReserva = async (reserva, user) => {
    if (!user || user.rol === "admin") return;

    try {
        await addDoc(collection(db, "reservas_backup"), {
            reservaIdOriginal: reserva.id,
            psicologoId: reserva.psicologoId,
            eliminadoPor: "psicologo",
            eliminadoPorId: user.uid,
            eliminadoEn: serverTimestamp(),
            motivo: "cancelacion_psicologo",
            dataOriginal: reserva
        });
    } catch (e) {
        console.error("Error guardando backup de reserva:", e);
    }
};

// =====================================================
// 🗑️ ELIMINAR RESERVA CON BACKUP (CLOUD FUNCTION)
// SOLO ADMIN
// =====================================================
export const eliminarReservaConBackupCF = async (reservaId) => {
    try {
        const functions = getFunctions();
        const eliminar = httpsCallable(functions, "eliminarReservaConBackup");

        const res = await eliminar({ reservaId });
        return res.data;
    } catch (error) {
        console.error("Error Cloud Function eliminarReservaConBackup:", error);
        throw error;
    }
};
