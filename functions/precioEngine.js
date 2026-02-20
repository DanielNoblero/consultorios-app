// precioEngine.js
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

async function recalcularSemana(db, psicologoId, fechaReferencia) {
    const configSnap = await db.collection("configuracion").doc("precioConsulta").get();
    const config = configSnap.data() || {};
    const precioBase = Number(config.precioBase || 250);
    const precioDescuento = Number(config.precioDescuento || 230);

    const lunes = getMonday(new Date(`${fechaReferencia}T00:00:00`));
    const lunesStr = lunes.toISOString().split("T")[0];
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);
    const domingoStr = domingo.toISOString().split("T")[0];

    const reservasSnap = await db
        .collection("reservas")
        .where("psicologoId", "==", psicologoId)
        .where("fecha", ">=", lunesStr)
        .where("fecha", "<=", domingoStr)
        .get();

    if (reservasSnap.empty) return;

    const userSnap = await db.collection("usuarios").doc(psicologoId).get();
    const userData = userSnap.data() || {};
    const isAdmin = userData.rol === "admin";

    const reservasPsicologo = [];
    const reservasAdmin = [];

    for (const doc of reservasSnap.docs) {
        const r = doc.data();
        if (!r.fecha) continue;

        if (isAdmin) {
            if (Number(r.precio) !== 0 || !r.pagado) {
                reservasAdmin.push({ id: doc.id });
            }
        } else if (!r.pagado) {
            reservasPsicologo.push({ id: doc.id, precioActual: Number(r.precio) });
        }
    }

    const aplicaDescuento = reservasPsicologo.length >= 10;
    const nuevoPrecio = aplicaDescuento ? precioDescuento : precioBase;
    const updatesPsicologo = reservasPsicologo.filter(r => r.precioActual !== nuevoPrecio);

    for (let i = 0; i < updatesPsicologo.length; i += 450) {
        const chunk = updatesPsicologo.slice(i, i + 450);
        const batch = db.batch();
        chunk.forEach(r => batch.update(db.collection("reservas").doc(r.id), { precio: nuevoPrecio }));
        await batch.commit();
    }

    for (let i = 0; i < reservasAdmin.length; i += 450) {
        const chunk = reservasAdmin.slice(i, i + 450);
        const batch = db.batch();
        chunk.forEach(r => batch.update(db.collection("reservas").doc(r.id), { precio: 0, pagado: true }));
        await batch.commit();
    }
}

module.exports = { recalcularSemana, getMonday };