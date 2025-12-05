// -------------------------------------------------------------
// index.js COMPLETO (Firebase Functions V2) — REPORTE + LIMPIEZA
// -------------------------------------------------------------

const { onRequest, onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer"); // (por si lo usás en otras funciones)

admin.initializeApp();
const db = admin.firestore();

/* =============================================================
   FUNCIÓN AUXILIAR: GENERAR EXCEL AGRUPADO POR PROFESIONAL
   - Solo incluye reservas pagadas y con precio > 0
   - Ignora reservas de admin (precio 0)
============================================================= */
async function construirReporteExcel(snapshot) {
    const usuariosSnap = await db.collection("usuarios").get();
    const usersMap = {};

    usuariosSnap.forEach((doc) => {
        const u = doc.data();
        usersMap[doc.id] = `${u.nombre || ""} ${u.apellido || ""}`.trim();
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reporte Mensual");

    // Agrupamos por profesional, pero filtrando antes
    const reservasPorProfesional = {};

    snapshot.forEach((doc) => {
        const r = doc.data();

        // ✅ Ignoramos reservas que no generan dinero:
        // - No pagadas
        // - Con precio 0 o vacío (admin, pruebas, etc.)
        const precio = Number(r.precio || 0);
        const estaPagada = !!r.pagado;

        if (!estaPagada || precio <= 0) {
            return; // No entra al reporte
        }

        const uid = r.usuarioId || r.userId || "sin-usuario";
        if (!reservasPorProfesional[uid]) reservasPorProfesional[uid] = [];
        reservasPorProfesional[uid].push(r);
    });

    // Si después de filtrar no quedó nada útil
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
        titulo.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4169E1" },
        };

        const header = sheet.addRow([
            "Consultorio",
            "Fecha",
            "Hora Inicio",
            "Hora Fin",
            "Precio",
        ]);
        header.font = { bold: true };
        header.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };

        let total = 0;

        reservas.forEach((r) => {
            const precio = Number(r.precio || 0);

            sheet.addRow([
                r.consultorio || "",
                r.fecha || "",
                r.horaInicio || "",
                r.horaFin || "",
                precio,
            ]);

            total += precio;
            totalGeneral += precio;
        });

        const totalRow = sheet.addRow([`TOTAL PROFESIONAL: ${total}`]);
        totalRow.font = { bold: true, color: { argb: "FF006400" } };
        totalRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFCCFFCC" },
        };
    });

    sheet.addRow([]);
    const totalGrl = sheet.addRow([`TOTAL GENERAL GENERADO: ${totalGeneral}`]);
    totalGrl.font = { bold: true, color: { argb: "FFFFFFFF" } };
    totalGrl.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF228B22" },
    };

    return await workbook.xlsx.writeBuffer();
}

/* =============================================================
   1) GENERAR REPORTE MANUAL (Excel) + LIMPIEZA DEL MES PASADO
   - Reporte: solo reservas pagadas y precio > 0
   - Limpieza:
       * Borra SIEMPRE reservas de precio 0 (admin, sin deuda)
       * Borra reservas con precio > 0 SOLO si están pagadas
============================================================= */
exports.generarReporteManual = onRequest(
    {
        cors: true,
        invoker: "public",
    },
    async (req, res) => {
        // Preflight para CORS
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

            // --- MES PASADO ---
            const mesPasado = mesActual === 0 ? 11 : mesActual - 1;
            const anioMesPasado = mesActual === 0 ? anioActual - 1 : anioActual;

            const inicioMesPasado = new Date(anioMesPasado, mesPasado, 1);
            const finMesPasado = new Date(
                anioMesPasado,
                mesPasado + 1,
                0,
                23,
                59,
                59
            );

            // 🔥 Formato correcto AAAA-MM-DD
            const inicioStr = inicioMesPasado.toISOString().split("T")[0];
            const finStr = finMesPasado.toISOString().split("T")[0];

            // --- TRAER RESERVAS DEL PERÍODO ---
            // Traemos TODAS las reservas del mes pasado (pagadas, no pagadas, admin, etc.)
            const snapshot = await db
                .collection("reservas")
                .where("fecha", ">=", inicioStr)
                .where("fecha", "<=", finStr)
                .get();

            // --- GENERAR EXCEL (dentro se filtran pagadas y precio > 0) ---
            const buffer = await construirReporteExcel(snapshot);

            // --- ENVIAR ARCHIVO ---
            res.set(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            res.set(
                "Content-Disposition",
                "attachment; filename=reporte-mensual.xlsx"
            );

            // --- LIMPIEZA DESPUÉS DE ENVIAR EL ARCHIVO ---
            const batch = db.batch();
            snapshot.forEach((doc) => {
                const r = doc.data();
                const fechaReserva = new Date(r.fecha + "T00:00:00");
                const precio = Number(r.precio || 0);
                const estaPagada = !!r.pagado;

                // Solo consideramos reservas del pasado
                if (fechaReserva >= hoy) {
                    return;
                }

                const esPrecioCero = precio <= 0;

                // ✅ Reglas de borrado:
                // - Si es precio 0 (admin / sin deuda) → borrar SIEMPRE al cerrar el mes.
                // - Si tiene precio > 0 → borrar solo si está pagada.
                if (esPrecioCero || estaPagada) {
                    batch.delete(doc.ref);
                }
            });

            await batch.commit();

            return res.status(200).send(Buffer.from(buffer));
        } catch (error) {
            console.error("Error generando reporte:", error);

            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Headers", "*");

            return res.status(500).send("Error generando reporte");
        }
    }
);

/* =============================================================
   2) ASIGNAR ROL ADMIN (Custom Claims)
============================================================= */
exports.asignarRolAdmin = onCall(async (request) => {
    try {
        // 🔐 Validación correcta para múltiples admins
        if (request.auth?.token?.rol !== "admin") {
            throw new Error(
                "No autorizado: solo administradores pueden asignar roles."
            );
        }

        const email = request.data.email;
        const rol = request.data.rol || "admin";

        if (!email) throw new Error("Email requerido");

        const userRecord = await admin.auth().getUserByEmail(email);

        await admin.auth().setCustomUserClaims(userRecord.uid, {
            rol,
            admin: rol === "admin",
        });

        return {
            ok: true,
            message: `Rol '${rol}' asignado a ${email}`,
        };
    } catch (error) {
        logger.error("Error asignando rol:", error);
        throw new Error(error.message || "Error interno");
    }
});
