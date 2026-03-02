// -------------------------------------------------------------
// index.js COMPLETO (Firebase Functions V2) — REPORTE + LIMPIEZA
// -------------------------------------------------------------

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");

setGlobalOptions({
    region: "southamerica-east1",
    maxInstances: 10,
});

admin.initializeApp();
const db = admin.firestore();

const { recalcularSemana, getMonday } = require("./precioEngine");

// =============================================================
// FUNCIÓN AUXILIAR: GENERAR EXCEL AGRUPADO POR PROFESIONAL
// =============================================================
async function construirReporteExcel(snapshot) {
    const usuariosSnap = await db.collection("usuarios").get();
    const usersMap = {};
    usuariosSnap.forEach((doc) => {
        const u = doc.data();
        usersMap[doc.id] = `${u.nombre || ""} ${u.apellido || ""}`.trim();
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte Mensual");

    const reservasPorProfesional = {};
    snapshot.forEach((doc) => {
        const r = doc.data();
        const precio = Number(r.precio || 0);
        const estaPagada = !!r.pagado;

        if (!estaPagada || precio <= 0) return;

        const uid = r.usuarioId || r.userId || "sin-usuario";
        if (!reservasPorProfesional[uid]) reservasPorProfesional[uid] = [];
        reservasPorProfesional[uid].push(r);
    });

    if (Object.keys(reservasPorProfesional).length === 0) {
        sheet.addRow(["No hay reservas pagadas en este período."]);
        sheet.getRow(1).font = { bold: true };
        return await workbook.xlsx.writeBuffer();
    }

    let totalGeneral = 0;

    Object.keys(reservasPorProfesional).forEach((uid) => {
        const nombre = usersMap[uid] || "Profesional sin nombre";
        const reservas = reservasPorProfesional[uid];

        sheet.addRow([]);
        const titulo = sheet.addRow([`=== ${nombre} ===`]);
        titulo.font = { bold: true, color: { argb: "FFFFFFFF" } };
        titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4169E1" } };

        const header = sheet.addRow(["Consultorio", "Fecha", "Hora Inicio", "Hora Fin", "Precio"]);
        header.font = { bold: true };
        header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };

        let total = 0;
        reservas.forEach((r) => {
            const precio = Number(r.precio || 0);
            sheet.addRow([r.consultorio || "", r.fecha || "", r.horaInicio || "", r.horaFin || "", precio]);
            total += precio;
            totalGeneral += precio;
        });

        const totalRow = sheet.addRow([`TOTAL PROFESIONAL: ${total}`]);
        totalRow.font = { bold: true, color: { argb: "FF006400" } };
        totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCFFCC" } };
    });

    sheet.addRow([]);
    const totalGrl = sheet.addRow([`TOTAL GENERAL GENERADO: ${totalGeneral}`]);
    totalGrl.font = { bold: true, color: { argb: "FFFFFFFF" } };
    totalGrl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF228B22" } };

    return await workbook.xlsx.writeBuffer();
}

// =============================================================
// 1) GENERAR REPORTE MANUAL (Excel) + LIMPIEZA DEL MES PASADO
// =============================================================
exports.generarReporteManual = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.set("Access-Control-Allow-Headers", "*");
        return res.status(204).send();
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "*");

    try {
        const hoy = new Date();
        const mesActual = hoy.getMonth();
        const anioActual = hoy.getFullYear();
        const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
        const anioMesPasado = mesActual === 0 ? anioActual - 1 : anioActual;
        const inicioMesPasado = new Date(anioMesPasado, mesPasado, 1);
        const finMesPasado = new Date(anioMesPasado, mesPasado + 1, 0, 23, 59, 59);
        const inicioStr = inicioMesPasado.toISOString().split("T")[0];
        const finStr = finMesPasado.toISOString().split("T")[0];

        const snapshot = await db.collection("reservas").where("fecha", ">=", inicioStr).where("fecha", "<=", finStr).get();
        const buffer = await construirReporteExcel(snapshot);

        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", "attachment; filename=reporte-mensual.xlsx");

        const batch = db.batch();
        snapshot.forEach((doc) => {
            const r = doc.data();
            const fechaReserva = new Date(r.fecha + "T00:00:00");
            const precio = Number(r.precio || 0);
            const estaPagada = !!r.pagado;
            if (fechaReserva >= hoy) return;
            if (precio <= 0 || estaPagada) batch.delete(doc.ref);
        });
        await batch.commit();

        return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        logger.error("Error generando reporte:", error);
        return res.status(500).send("Error generando reporte");
    }
});

// =============================================================
// 2) ASIGNAR ROL ADMIN
// =============================================================
exports.asignarRolAdmin = onCall(async (request) => {
    if (request.auth?.token?.rol !== "admin") throw new HttpsError("permission-denied", "Solo administradores pueden asignar roles.");
    const { email, rol = "admin" } = request.data;
    if (!email) throw new HttpsError("invalid-argument", "Email requerido");

    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(userRecord.uid, { rol, admin: rol === "admin" });

    return { ok: true, message: `Rol '${rol}' asignado a ${email}` };
});

// =============================================================
// 3) ELIMINAR SERIE O RESERVA CON BACKUP
// =============================================================
exports.eliminarSerieConBackup = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "No autenticado");
    const { reservaId } = request.data;
    if (!reservaId) throw new HttpsError("invalid-argument", "reservaId requerido");

    const baseRef = db.collection("reservas").doc(reservaId);
    const baseSnap = await baseRef.get();
    if (!baseSnap.exists) throw new HttpsError("not-found", "Reserva base no encontrada");
    const base = baseSnap.data();
    if (!base.groupId) throw new HttpsError("failed-precondition", "La reserva no pertenece a una serie");

    const snap = await db.collection("reservas").where("groupId", "==", base.groupId).get();
    const fechaBase = new Date(base.fecha + "T00:00:00");
    const futuras = snap.docs.filter(doc => {
        const r = doc.data();
        if (!r.fecha) return false;
        const fechaReserva = new Date(r.fecha + "T00:00:00");
        return fechaReserva >= fechaBase;
    });

    if (futuras.length === 0) return { ok: false, message: "No hay reservas futuras para eliminar" };

    const batch = db.batch();
    for (const docSnap of futuras) {
        await db.collection("reservas_backup").add({
            dataOriginal: { id: docSnap.id, ...docSnap.data() },
            eliminadaPor: request.auth.uid,
            eliminadaEn: admin.firestore.FieldValue.serverTimestamp(),
            motivo: "cancelacion_serie",
            restaurado: false,
        });
        batch.delete(docSnap.ref);
    }
    await batch.commit();

    return { ok: true, tipo: "serie-futura", cantidad: futuras.length };
});

exports.eliminarReservaConBackup = onCall(async (request) => {
    const user = request.auth;
    if (!user) throw new HttpsError("unauthenticated", "No autenticado");

    const userSnap = await db.collection("usuarios").doc(user.uid).get();
    if (!userSnap.exists || userSnap.data().rol !== "admin") throw new HttpsError("permission-denied", "Solo admin");

    const { reservaId } = request.data;
    const reservaRef = db.collection("reservas").doc(reservaId);
    const reservaSnap = await reservaRef.get();
    if (!reservaSnap.exists) throw new HttpsError("not-found", "Reserva no encontrada");

    await db.collection("reservas_backup").add({
        dataOriginal: { id: reservaId, ...reservaSnap.data() },
        eliminadoPor: "admin",
        eliminadoPorId: user.uid,
        eliminadoEn: admin.firestore.FieldValue.serverTimestamp(),
        motivo: "eliminacion_admin",
        restaurado: false,
    });

    await reservaRef.delete();
    return { ok: true };
});

// =============================================================
// 4) REACCIONAR AL CAMBIO DE RESERVA
// =============================================================
exports.recalcularAlCambiarReserva = onDocumentWritten({ document: "reservas/{reservaId}", region: "southamerica-east1" }, async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!after && before?.psicologoId && before?.fecha) {
        await recalcularSemana(db, before.psicologoId, before.fecha);
        return;
    }

    if (after?.psicologoId && after?.fecha && !after.pagado) {
        await recalcularSemana(db, after.psicologoId, after.fecha);
    }
});

// =============================================================
// 5) REACCIONAR AL CAMBIO DE CONFIG PRECIO
// =============================================================
exports.recalcularPreciosAlCambiarConfig = onDocumentUpdated(
    { document: "configuracion/precioConsulta", region: "southamerica-east1" },
    async (event) => {
        const hoyStr = new Date().toISOString().split("T")[0];

        // 1. Buscamos todas las reservas futuras que no estén pagadas
        const reservasSnap = await db.collection("reservas")
            .where("fecha", ">=", hoyStr)
            .where("pagado", "==", false)
            .get();

        if (reservasSnap.empty) return;

        // 2. Agrupamos qué semanas necesita recalcular cada psicólogo
        // Usamos un Set para no repetir el recalculo de la misma semana
        const tareas = {}; 

        reservasSnap.forEach(doc => {
            const r = doc.data();
            if (!r.psicologoId || !r.fecha) return;

            // Obtenemos el lunes de esa reserva para identificar la semana
            const lunes = getMonday(new Date(`${r.fecha}T00:00:00`)).toISOString().split("T")[0];
            
            if (!tareas[r.psicologoId]) tareas[r.psicologoId] = new Set();
            tareas[r.psicologoId].add(lunes);
        });

        // 3. Ejecutamos el recalculo para cada psicólogo en cada semana afectada
        for (const psicologoId in tareas) {
            for (const lunesStr of tareas[psicologoId]) {
                console.log(`Recalculando Psico: ${psicologoId} - Semana: ${lunesStr}`);
                // Llamamos a tu motor de precios para esa semana específica
                await recalcularSemana(db, psicologoId, lunesStr);
            }
        }
    }
);
