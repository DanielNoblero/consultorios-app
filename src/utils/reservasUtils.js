// =============================================
// utils/reservasUtils.js
// SISTEMA COMPLETO, ACTUALIZADO Y CORREGIDO
// SOLO USA psicologoId
//
// NOTA: La creación de reservas (antes "confirmarReserva") se movió
// a la Cloud Function `confirmarReservaCF` en functions/index.js,
// que usa transacciones de Firestore para evitar duplicados y
// conflictos de horario de forma atómica. Este archivo solo
// mantiene las funciones que siguen usándose desde el cliente.
// =============================================

import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import { getPreciosConfig } from "./precioUtils";

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
// ELIMINAR RESERVAS (UNA O TODA LA SERIE)
// =====================================================
export const eliminarReserva = async (
    reserva,
    eliminarSerie = false
) => {
    if (!reserva) return;

    try {
        // ---------------------------------------------
        // BORRAR UNA SOLA
        // ---------------------------------------------
        if (!reserva.groupId || !eliminarSerie) {
            await deleteDoc(doc(db, "reservas", reserva.id));

            // ♻️ RECALCULAR SEMANA AFECTADA
            await recalcularPreciosSemana(
                reserva.psicologoId,
                new Date(`${reserva.fecha}T00:00:00`)
            );

            return { ok: true, tipo: "una" };
        }

        // ---------------------------------------------
        // BORRAR SERIE → SOLO FUTURAS
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

        // ❌ BORRADO
        await Promise.all(
            futuras.map(r =>
                deleteDoc(doc(db, "reservas", r.id))
            )
        );

        const semanasAfectadas = new Set();

        futuras.forEach(r => {
            const lunes = getMonday(new Date(`${r.fecha}T00:00:00`)).toISOString();
            semanasAfectadas.add(lunes);
        });

        await Promise.all(
            Array.from(semanasAfectadas).map(lunesISO =>
                recalcularPreciosSemana(
                    reserva.psicologoId,
                    new Date(lunesISO)
                )
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

// =====================================================
// ♻️ RECALCULAR PRECIOS DE UNA SEMANA (POR CAMBIO DE TARIFAS)
// =====================================================

export const recalcularPreciosSemana = async (psicologoId, fechaReferencia) => {
    const { precioBase, precioDescuento, fechaCambio } = await getPreciosConfig();

    const lunes = getMonday(fechaReferencia);
    const domingo = getSunday(fechaReferencia);

    const snap = await getDocs(query(
        collection(db, "reservas"),
        where("psicologoId", "==", psicologoId)
    ));

    const semana = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => {
            const f = new Date(`${r.fecha}T00:00:00`);
            return f >= lunes && f <= domingo;
        });

    // ✅ Descuento basado en TODAS las reservas de la semana
    const descuento = semana.length >= 10;
    const nuevoPrecio = descuento ? precioDescuento : precioBase;

    await Promise.all(
        semana
            .filter(r => !r.pagado)                                  // ✅ no tocar pagadas
            .filter(r => !fechaCambio || r.fecha >= fechaCambio)     // ✅ respetar fechaCambio
            .filter(r => r.precio !== nuevoPrecio)                   // ✅ evitar escrituras innecesarias
            .map(r => updateDoc(doc(db, "reservas", r.id), { precio: nuevoPrecio }))
    );
};