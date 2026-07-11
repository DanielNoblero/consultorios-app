// -------------------------------------------------------------
// index.js COMPLETO (Firebase Functions V2) — REPORTE + LIMPIEZA
// -------------------------------------------------------------

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const ExcelJS = require("exceljs");
const { v4: uuidv4 } = require("uuid");

setGlobalOptions({
    region: "southamerica-east1",
    maxInstances: 10,
});

admin.initializeApp();
const db = admin.firestore();

const { recalcularSemana, getMonday } = require("./precioEngine");


// =============================================================
// FUNCIÓN ÚNICA: GENERAR EXCEL AGRUPADO
// =============================================================
async function construirReporteExcel(snapshot) {
    const usuariosSnap = await db.collection("usuarios").get();
    const usersMap = {};

    // Mapeo correcto: ID de documento -> Nombre y Apellido
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

        // Aquí usamos psicologoId para agrupar
        const uid = r.psicologoId || "sin-profesional";
        if (!reservasPorProfesional[uid]) reservasPorProfesional[uid] = [];
        reservasPorProfesional[uid].push(r);
    });

    if (Object.keys(reservasPorProfesional).length === 0) {
        sheet.addRow(["No hay reservas pagadas en este período."]);
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

        const header = sheet.addRow(["Consultorio", "Fecha", "Hora", "Precio"]);
        header.font = { bold: true };

        let total = 0;
        reservas.forEach((r) => {
            const precio = Number(r.precio || 0);
            sheet.addRow([r.consultorio || "", r.fecha || "", `${r.horaInicio}-${r.horaFin}`, precio]);
            total += precio;
        });

        totalGeneral += total;
        sheet.addRow([`TOTAL PROFESIONAL: ${total}`]).font = { bold: true };
    });

    sheet.addRow([]);
    sheet.addRow([`TOTAL GENERAL GENERADO: ${totalGeneral}`]).font = { bold: true };

    return await workbook.xlsx.writeBuffer();
}

// =============================================================
// ENDPOINT DE REPORTE
// =============================================================
exports.generarReporteManual = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    if (req.method === "OPTIONS") return res.status(204).send();

    try {
        const hoy = new Date();
        const mesPasado = hoy.getMonth() === 0 ? 11 : hoy.getMonth() - 1;
        const anio = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();

        const inicioStr = `${anio}-${String(mesPasado + 1).padStart(2, "0")}-01`;
        const finStr = `${anio}-${String(mesPasado + 1).padStart(2, "0")}-31`;

        const snapshot = await db.collection("reservas")
            .where("fecha", ">=", inicioStr)
            .where("fecha", "<=", finStr)
            .get();

        const buffer = await construirReporteExcel(snapshot);

        const batch = db.batch();
        snapshot.forEach((doc) => {
            const r = doc.data();
            if (!!r.pagado || Number(r.precio || 0) <= 0) batch.delete(doc.ref);
        });
        await batch.commit();

        res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.set("Content-Disposition", "attachment; filename=reporte-mensual.xlsx");
        return res.status(200).send(Buffer.from(buffer));
    } catch (error) {
        logger.error(error);
        return res.status(500).send("Error interno");
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
exports.confirmarReservaCF = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "No autenticado");

    const {
        reservaBase,
        tipoReserva,
        recurrenciaTipo,
        recurrenciaCantidad,
    } = request.data;

    if (!reservaBase) throw new HttpsError("invalid-argument", "reservaBase requerido");

    const MAX_RECURRENCIA = 52; // tope razonable (1 año de reservas semanales)
    if (recurrenciaCantidad && (recurrenciaCantidad < 1 || recurrenciaCantidad > MAX_RECURRENCIA)) {
        throw new HttpsError("invalid-argument", `recurrenciaCantidad debe estar entre 1 y ${MAX_RECURRENCIA}`);
    }

    const psicologoId = request.auth.uid;

    // Perfil del psicólogo
    const perfilSnap = await db.collection("usuarios").doc(psicologoId).get();
    const perfil = perfilSnap.exists ? perfilSnap.data() : {};
    const esAdmin = perfil.rol === "admin";

    // Config de precios
    const configSnap = await db.collection("configuracion").doc("precioConsulta").get();
    const config = configSnap.data() || {};
    const precioBase = Number(config.precioBase || 250);
    const precioDescuento = Number(config.precioDescuento || 230);

    // ---------------------------------------------
    // GENERAR TODAS LAS FECHAS DE LA SERIE
    // ---------------------------------------------
    const baseDate = new Date(`${reservaBase.fecha}T00:00:00`);

    const total = Math.min(
    tipoReserva === "Recurrente"
        ? recurrenciaTipo === "Mensual"
            ? recurrenciaCantidad * 4
            : recurrenciaTipo === "Anual"
                ? recurrenciaCantidad * 52
                : recurrenciaCantidad
        : 1,
    260
    ); // tope de 5 años de reservas semanales

    const groupId = tipoReserva === "Recurrente" ? uuidv4() : null;

    const fechasGeneradas = [];
    for (let i = 0; i < total; i++) {
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + i * 7);
        fechasGeneradas.push(date.toISOString().split("T")[0]);
    }

    const creadas = [];
    const fechasConConflicto = [];

    // ---------------------------------------------
    // CREAR CADA RESERVA DENTRO DE UNA TRANSACCIÓN
    // ---------------------------------------------
    // Cada fecha se procesa en su propia transacción: se verifica
    // conflicto de horario Y duplicado propio, y se crea, todo de
    // forma atómica. Si dos ejecuciones paralelas intentan lo mismo,
    // Firestore serializa las transacciones automáticamente.
    for (const fechaStr of fechasGeneradas) {
        try {
            const resultado = await db.runTransaction(async (transaction) => {
                // 1) Buscar conflictos de horario en el consultorio (cualquier psicólogo)
                const qConflicto = db.collection("reservas")
                    .where("fecha", "==", fechaStr)
                    .where("consultorio", "==", reservaBase.consultorio);

                const snapConflicto = await transaction.get(qConflicto);

                const hayConflicto = snapConflicto.docs.some((doc) => {
                    const r = doc.data();
                    return r.horaInicio < reservaBase.horaFin && r.horaFin > reservaBase.horaInicio;
                });

                if (hayConflicto) {
                    return { ok: false, motivo: "conflicto" };
                }

                // 2) Crear la reserva
                const precio = esAdmin ? 0 : precioBase; // el descuento semanal se recalcula después vía trigger
                const nuevaRef = db.collection("reservas").doc();

                transaction.set(nuevaRef, {
                    psicologoId,
                    nombre: perfil.nombre || "",
                    apellido: perfil.apellido || "",
                    email: perfil.email || request.auth.token.email || "",
                    fecha: fechaStr,
                    horaInicio: reservaBase.horaInicio,
                    horaFin: reservaBase.horaFin,
                    consultorio: reservaBase.consultorio,
                    tipo: tipoReserva === "Ocasional" ? "Ocasional" : `Recurrente ${recurrenciaTipo}`,
                    precio,
                    pagado: esAdmin,
                    groupId,
                });

                return { ok: true, id: nuevaRef.id };
            });

            if (resultado.ok) {
                creadas.push({ id: resultado.id, fecha: fechaStr });
            } else {
                fechasConConflicto.push(fechaStr);
            }
        } catch (error) {
            logger.error(`Error creando reserva para ${fechaStr}:`, error);
            fechasConConflicto.push(fechaStr);
        }
    }

    if (creadas.length === 0) {
        const fechasFormateadas = fechasConConflicto
            .map((f) => {
                const [, month, day] = f.split("-");
                return `${day}/${month}`;
            })
            .join(", ");
        return {
            ok: false,
            mensaje: `No se pudo crear ninguna reserva. Todas las fechas (${fechasFormateadas}) estaban ocupadas.`,
        };
    }

    // Recalcular precios de la semana afectada (dispara el trigger normal
    // vía recalcularAlCambiarReserva, no hace falta hacer nada extra acá)

    if (fechasConConflicto.length > 0) {
        const fechasFormateadas = fechasConConflicto
            .map((f) => {
                const [, month, day] = f.split("-");
                return `${day}/${month}`;
            })
            .join(", ");
        return {
            ok: true,
            parcial: true,
            mensaje: `No se pudieron reservar ${fechasConConflicto.length} fecha(s) por conflicto de horario: ${fechasFormateadas}. El resto de la serie se creó correctamente.`,
        };
    }

    return { ok: true };
});
// =============================================================
// AGREGAR ESTO a tu index.js existente (Cloud Functions)
// =============================================================
// Función HTTP que detecta:
// 1) Reservas que se solapan entre DISTINTOS psicólogos
// 2) Reservas DUPLICADAS del MISMO psicólogo (mismo día, horario
//    y consultorio, creadas dos veces por error)
//
// Una vez deployada, la podés abrir directamente desde Safari
// en tu iPhone visitando la URL que te da Firebase al deployar.
// =============================================================

function horaAMinutos(hora) {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
}

function seSolapan(inicioA, finA, inicioB, finB) {
    return horaAMinutos(inicioA) < horaAMinutos(finB) &&
        horaAMinutos(inicioB) < horaAMinutos(finA);
}

exports.detectarConflictos = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    const CLAVE_SECRETA = "iaIQye2DRoD6qJcExzxHqukvrJ1VcQeCJb-Zws7KUVA";
    if (req.query.key !== CLAVE_SECRETA) {
        return res.status(403).send("Acceso denegado");
    }
    try {
        const snapshot = await db.collection("reservas").get();

        const reservas = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        const grupos = {};
        reservas.forEach((r) => {
            if (!r.fecha || !r.consultorio || !r.horaInicio || !r.horaFin) return;
            const key = `${r.fecha}__${r.consultorio}`;
            if (!grupos[key]) grupos[key] = [];
            grupos[key].push(r);
        });

        const conflictosEncontrados = [];
        const duplicadosEncontrados = [];

        Object.values(grupos).forEach((lista) => {
            if (lista.length < 2) return;

            for (let i = 0; i < lista.length; i++) {
                for (let j = i + 1; j < lista.length; j++) {
                    const a = lista[i];
                    const b = lista[j];

                    if (!seSolapan(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) continue;

                    const resumen = {
                        fecha: a.fecha,
                        consultorio: a.consultorio,
                        reservaA: {
                            id: a.id,
                            nombre: `${a.nombre} ${a.apellido}`,
                            email: a.email,
                            horario: `${a.horaInicio}-${a.horaFin}`,
                            tipo: a.tipo,
                            pagado: a.pagado,
                        },
                        reservaB: {
                            id: b.id,
                            nombre: `${b.nombre} ${b.apellido}`,
                            email: b.email,
                            horario: `${b.horaInicio}-${b.horaFin}`,
                            tipo: b.tipo,
                            pagado: b.pagado,
                        },
                    };

                    if (a.psicologoId === b.psicologoId) {
                        duplicadosEncontrados.push(resumen);
                    } else {
                        conflictosEncontrados.push(resumen);
                    }
                }
            }
        });

        let html = `
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: -apple-system, sans-serif; padding: 16px; background: #f8fafc; }
                    h1 { font-size: 20px; color: #1e293b; }
                    h2 { font-size: 16px; color: #1e293b; margin-top: 24px; }
                    .resumen { color: #475569; margin-bottom: 8px; }
                    .conflicto {
                        background: white; border: 1px solid #fecaca;
                        border-radius: 12px; padding: 12px; margin-bottom: 12px;
                    }
                    .duplicado {
                        background: white; border: 1px solid #fde68a;
                        border-radius: 12px; padding: 12px; margin-bottom: 12px;
                    }
                    .fecha { font-weight: bold; color: #b91c1c; margin-bottom: 6px; }
                    .fecha-dup { font-weight: bold; color: #92400e; margin-bottom: 6px; }
                    .reserva { font-size: 14px; margin: 4px 0; color: #334155; }
                    .ok { color: #16a34a; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>Detector de Conflictos de Reservas</h1>
                <p class="resumen">Total de reservas revisadas: ${reservas.length}</p>

                <h2>⚠️ Conflictos entre psicólogos distintos: ${conflictosEncontrados.length}</h2>
        `;

        if (conflictosEncontrados.length === 0) {
            html += `<p class="ok">✅ Ninguno.</p>`;
        } else {
            conflictosEncontrados.forEach((c, idx) => {
                html += `
                    <div class="conflicto">
                        <div class="fecha">#${idx + 1} — ${c.fecha} | Consultorio ${c.consultorio}</div>
                        <div class="reserva">🔹 ${c.reservaA.nombre} (${c.reservaA.email})<br>
                            ${c.reservaA.horario} | ${c.reservaA.tipo} | pagado: ${c.reservaA.pagado}<br>
                            <small>id: ${c.reservaA.id}</small></div>
                        <div class="reserva">🔸 ${c.reservaB.nombre} (${c.reservaB.email})<br>
                            ${c.reservaB.horario} | ${c.reservaB.tipo} | pagado: ${c.reservaB.pagado}<br>
                            <small>id: ${c.reservaB.id}</small></div>
                    </div>
                `;
            });
        }

        html += `<h2>🟡 Reservas duplicadas (mismo psicólogo): ${duplicadosEncontrados.length}</h2>`;

        if (duplicadosEncontrados.length === 0) {
            html += `<p class="ok">✅ Ninguna.</p>`;
        } else {
            duplicadosEncontrados.forEach((c, idx) => {
                html += `
                    <div class="duplicado">
                        <div class="fecha-dup">#${idx + 1} — ${c.fecha} | Consultorio ${c.consultorio}</div>
                        <div class="reserva"><b>${c.reservaA.nombre}</b> (${c.reservaA.email})</div>
                        <div class="reserva">Reserva A: ${c.reservaA.horario} | ${c.reservaA.tipo} | pagado: ${c.reservaA.pagado}<br>
                            <small>id: ${c.reservaA.id}</small></div>
                        <div class="reserva">Reserva B: ${c.reservaB.horario} | ${c.reservaB.tipo} | pagado: ${c.reservaB.pagado}<br>
                            <small>id: ${c.reservaB.id}</small></div>
                    </div>
                `;
            });
        }

        html += `</body></html>`;

        res.set("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);
    } catch (error) {
        logger.error(error);
        return res.status(500).send("Error interno: " + error.message);
    }
});