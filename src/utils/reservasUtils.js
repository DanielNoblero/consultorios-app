import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc } from "firebase/firestore";

/**
 * 🔹 Obtiene los precios configurados desde Firestore
 */
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

/**
 * 🔹 Devuelve el lunes de la semana de una fecha
 */
export const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

/**
 * 🔹 Devuelve el domingo de la semana de una fecha
 */
export const getSunday = (date) => {
    const lunes = getMonday(date);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);
    return domingo;
};

/**
 * 🔹 Trae todas las reservas de un usuario
 */
export const traerReservasUsuario = async (userId) => {
    if (!userId) return [];
    try {
        const q = query(collection(db, "reservas"), where("usuarioId", "==", userId));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((d) => {
            const fechaStr = d.data().fecha;
            return {
                id: d.id,
                ...d.data(),
                fecha: fechaStr, // string para render
                fechaObj: new Date(`${fechaStr}T00:00:00`) // Date para cálculos
            };
        });
    } catch (error) {
        console.error("Error al traer reservas del usuario:", error);
        return [];
    }
};

/**
 * 🔹 Función auxiliar para actualizar el precio de una reserva en Firestore
 */
const updateReservationPrice = async (id, newPrice) => {
    if (!id) return;
    try {
        const reservaRef = doc(db, "reservas", id);
        await updateDoc(reservaRef, { precio: newPrice });
    } catch (error) {
        console.error(`Error al actualizar el precio de la reserva ${id}:`, error);
    }
};

/**
 * 🔹 Trae las reservas de un día y consultorio específicos
 */
export const traerReservas = async (fechaSeleccionada, consultorio, getIniciales, showNotification) => {
    if (!fechaSeleccionada) return [];

    const year = fechaSeleccionada.getFullYear();
    const month = (fechaSeleccionada.getMonth() + 1).toString().padStart(2, "0");
    const day = fechaSeleccionada.getDate().toString().padStart(2, "0");
    const fechaFormateada = `${year}-${month}-${day}`;

    try {
        const q = query(
            collection(db, "reservas"),
            where("fecha", "==", fechaFormateada),
            where("consultorio", "==", consultorio)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return [];

        const reservas = snapshot.docs.map((d) => {
            const fechaStr = d.data().fecha;
            return {
                id: d.id,
                ...d.data(),
                fecha: fechaStr,
                fechaObj: new Date(`${fechaStr}T00:00:00`)
            };
        });

        const userIds = [...new Set(reservas.map((r) => r.usuarioId).filter(Boolean))];

        let perfiles = {};
        if (userIds.length > 0) {
            const perfilDocs = await Promise.all(userIds.map((id) => getDoc(doc(db, "usuarios", id))));
            perfilDocs.forEach((snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    perfiles[snap.id] = {
                        nombre: data.nombre || "",
                        apellido: data.apellido || "",
                    };
                }
            });
        }

        const reservasCompletas = reservas.map((r) => {
            const perfil = perfiles[r.usuarioId] || { nombre: r.nombre || "Desconocido", apellido: r.apellido || "Usuario" };
            return {
                ...r,
                nombre: perfil.nombre,
                apellido: perfil.apellido,
                iniciales: getIniciales(perfil.nombre, perfil.apellido),
            };
        });

        // Ordenar por fecha + hora
        reservasCompletas.sort((a, b) => new Date(`${a.fecha}T${a.horaInicio}`) - new Date(`${b.fecha}T${b.horaInicio}`));

        return reservasCompletas;

    } catch (error) {
        console.error("Error al traer reservas:", error);
        showNotification?.("error", "Error al cargar reservas", "No se pudieron obtener las reservas del servidor.");
        return [];
    }
};

/**
 * 🔹 Confirma reservas y aplica descuento retroactivo por semana
 */
export const confirmarReserva = async ({
    reservaBase,
    tipoReserva,
    recurrenciaTipo,
    recurrenciaCantidad,
    user,
    traerReservas,
}) => {
    if (!reservaBase || !user) return;

    try {
        const { horaInicio, horaFin, consultorio } = reservaBase;
        const { precioBase, precioDescuento } = await getPreciosConfig();

        const reservasUsuarioExistentes = await traerReservasUsuario(user.uid);

        // 1️⃣ Preparar todas las reservas planeadas
        const reservasPlaneadas = [];
        const baseDate = new Date(`${reservaBase.fecha}T00:00:00`);
        let cantidad = 1;
        if (tipoReserva === "Recurrente") {
            cantidad = Math.max(1, recurrenciaCantidad);
            if (recurrenciaTipo === "Mensual") cantidad *= 4;
            if (recurrenciaTipo === "Anual") cantidad *= 52;
        }

        for (let i = 0; i < cantidad; i++) {
            const currentDate = new Date(baseDate);
            currentDate.setDate(baseDate.getDate() + 7 * i);
            const fechaStr = currentDate.toISOString().split("T")[0];

            reservasPlaneadas.push({
                usuarioId: user.uid,
                nombre: user.displayName || "",
                email: user.email,
                fecha: fechaStr,
                fechaObj: new Date(`${fechaStr}T00:00:00`),
                horaInicio,
                horaFin,
                consultorio,
                estado: "pendiente",
                tipo: tipoReserva === "Ocasional" ? "Ocasional" : `Recurrente ${recurrenciaTipo}`,
            });
        }

        // 2️⃣ Agrupar reservas (existentes + planeadas) por semana (lunes como clave)
        const semanas = {};
        [...reservasUsuarioExistentes, ...reservasPlaneadas].forEach(r => {
            const lunes = getMonday(r.fechaObj).toISOString().split("T")[0];
            if (!semanas[lunes]) semanas[lunes] = [];
            semanas[lunes].push(r);
        });

        // 3️⃣ Aplicar precio correcto según total de reservas en cada semana
        Object.values(semanas).forEach(reservasSemana => {
            const aplicaDescuento = reservasSemana.length >= 10;
            reservasSemana.forEach(r => {
                r.precio = aplicaDescuento ? precioDescuento : precioBase;
            });
        });

        // 4️⃣ Guardar reservas planeadas en Firestore con precio correcto
        await Promise.all(reservasPlaneadas.map(r => {
            const { fechaObj, ...rest } = r;
            return addDoc(collection(db, "reservas"), rest);
        }));

        // 5️⃣ Actualizar reservas existentes que necesitan descuento
        const updates = reservasUsuarioExistentes
            .filter(r => r.precio !== precioBase)
            .map(r => updateReservationPrice(r.id, r.precio));
        await Promise.all(updates);

        if (traerReservas) await traerReservas();

    } catch (error) {
        console.error("Error al confirmar reserva:", error);
    }
};
