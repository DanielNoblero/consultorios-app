// -------------------------------------------------------------
// index.js COMPLETO (Firebase Functions V2) — REPORTE + LIMPIEZA
// -------------------------------------------------------------

const { onRequest, onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

/* =============================================================
   FUNCIÓN AUXILIAR: GENERAR EXCEL AGRUPADO POR PROFESIONAL
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

    if (snapshot.empty) {
        sheet.addRow(["No hay reservas en este período."]);
        sheet.getRow(1).font = { bold: true };
        return await workbook.xlsx.writeBuffer();
    }

    const reservasPorProfesional = {};
    snapshot.forEach((doc) => {
        const r = doc.data();
        const uid = r.usuarioId || r.userId || "sin-usuario";
        if (!reservasPorProfesional[uid]) reservasPorProfesional[uid] = [];
        reservasPorProfesional[uid].push(r);
    });

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
            sheet.addRow([
                r.consultorio || "",
                r.fecha || "",
                r.horaInicio || "",
                r.horaFin || "",
                r.precio || 0,
            ]);
            total += r.precio || 0;
            totalGeneral += r.precio || 0;
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

/* =============================================================
   1) GENERAR REPORTE MANUAL (Excel) + LIMPIEZA DEL MES PASADO
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
            const finMesPasado = new Date(anioMesPasado, mesPasado + 1, 0, 23, 59, 59);

            // 🔥 Formato correcto AAAA-MM-DD
            const inicioStr = inicioMesPasado.toISOString().split("T")[0];
            const finStr = finMesPasado.toISOString().split("T")[0];

            // --- TRAER RESERVAS ---
            const snapshot = await db
                .collection("reservas")
                .where("pagado", "==", true)
                .where("fecha", ">=", inicioStr)
                .where("fecha", "<=", finStr)
                .get();

            // --- GENERAR EXCEL ---
            const buffer = await construirReporteExcel(snapshot);

            // --- ENVIAR ARCHIVO ---
            res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.set("Content-Disposition", "attachment; filename=reporte-mensual.xlsx");

            // --- LIMPIEZA DESPUÉS DE ENVIAR EL ARCHIVO ---
            const batch = db.batch();
            snapshot.forEach(doc => {
                const r = doc.data();
                const fechaReserva = new Date(r.fecha + "T00:00:00");

                if (fechaReserva < hoy) {
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
);p

/* =============================================================
   2) ASIGNAR ROL ADMIN (Custom Claims)
============================================================= */
exports.asignarRolAdmin = onCall((request) => {
    try {
        if (!request.auth?.token?.admin) throw new Error("No autorizado");

        const email = request.data.email;
        const rol = request.data.rol || "admin";

        if (!email) throw new Error("Email requerido");

        return admin
            .auth()
            .getUserByEmail(email)
            .then((userRecord) =>
                admin.auth().setCustomUserClaims(userRecord.uid, {
                    rol,
                    admin: rol === "admin",
                })
            )
            .then(() => ({
                ok: true,
                message: `Rol '${rol}' asignado a ${email}`,
            }))
            .catch((error) => {
                logger.error("Error asignando rol:", error);
                throw new Error("No se pudo asignar el rol");
            });
    } catch (error) {
        logger.error("Error:", error);
        throw new Error(error.message || "Error interno");
    }
});
