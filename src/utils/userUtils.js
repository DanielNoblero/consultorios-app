export const getIniciales = (nombre = "", apellido = "") => {
    // Limpiar espacios
    nombre = (nombre || "").trim();
    apellido = (apellido || "").trim();

    // Si nombre y apellido existen → usar ambos
    if (nombre.length > 0 && apellido.length > 0) {
        return (nombre[0] + apellido[0]).toUpperCase();
    }

    // Si solo hay nombre → usar primera letra
    if (nombre.length > 0) {
        return nombre[0].toUpperCase();
    }

    // Si solo hay apellido → usar primera letra
    if (apellido.length > 0) {
        return apellido[0].toUpperCase();
    }

    // Si no hay nada → inicial genérica
    return "U"; // de "Usuario"
};
