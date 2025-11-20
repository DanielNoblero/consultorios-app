export const getIniciales = (nombre, apellido) => {
    if (!nombre || !apellido) return "DU";
    return (nombre[0] + apellido[0]).toUpperCase();
};
