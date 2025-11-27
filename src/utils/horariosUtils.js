// utils/horariosUtils.js

// 🔥 Se genera solo una vez cuando se importa el archivo
const HORARIOS_CACHE = (() => {
  const horarios = [];
  let hora = 8;
  let minutos = 0;

  while (true) {
    const inicio = `${hora.toString().padStart(2, "0")}:${minutos
      .toString()
      .padStart(2, "0")}`;

    let finHora = hora + 1;
    let finMin = minutos;

    if (finHora > 22 || (finHora === 22 && finMin > 0)) break;

    const fin = `${finHora.toString().padStart(2, "0")}:${finMin
      .toString()
      .padStart(2, "0")}`;

    horarios.push({ inicio, fin });

    minutos += 30;
    if (minutos === 60) {
      minutos = 0;
      hora++;
    }

    if (hora >= 22) break;
  }

  return horarios;
})();

// 👍 Ahora no recalcula nunca
export const generarHorarios = () => HORARIOS_CACHE;


// 🔹 Mantengo getHoraFin igual
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
