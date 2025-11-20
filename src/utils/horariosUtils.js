// utils/horariosUtils.js
export const generarHorarios = () => {
  const horarios = [];
  let hora = 8;
  let minutos = 0;

  while (true) {
    const inicio = `${hora.toString().padStart(2, "0")}:${minutos
      .toString()
      .padStart(2, "0")}`;

    // Calcular fin (1 hora después)
    let finHora = hora + 1;
    let finMin = minutos;

    // Si el bloque termina después de 22:00 → detener el bucle
    if (finHora > 22 || (finHora === 22 && finMin > 0)) break;

    const fin = `${finHora.toString().padStart(2, "0")}:${finMin
      .toString()
      .padStart(2, "0")}`;

    horarios.push({ inicio, fin });

    // Avanzar media hora
    minutos += 30;
    if (minutos === 60) {
      minutos = 0;
      hora++;
    }

    // Evitar que se cree un bloque extra que termine después de 22:00
    if (hora >= 22) break;
  }

  return horarios;
};



// 🔹 Calcula la hora de fin agregando 1 hora exacta al inicio
export const getHoraFin = (horaInicio) => {
  const [h, m] = horaInicio.split(":").map(Number);
  const fechaTemp = new Date();
  fechaTemp.setHours(h, m, 0, 0);
  fechaTemp.setMinutes(fechaTemp.getMinutes() + 60);
  return `${fechaTemp.getHours().toString().padStart(2, "0")}:${fechaTemp
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};
