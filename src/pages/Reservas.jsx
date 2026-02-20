import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getISOWeek } from "date-fns";

import { useAuth } from "../context/AuthContext";
import { getPreciosConfig  } from "../utils/precioUtils";
import { generarHorarios } from "../utils/horariosUtils";
import { getIniciales } from "../utils/userUtils";
import { traerReservas, traerReservasUsuario } from "../utils/reservasUtils";

import Calendar from "../components/Calendar";
import NotificationModal from "../components/NotificationModal";
import ConfirmarReservaModal from "../components/ConfirmarReservaModal";
import CancelarReservaModal from "../components/CancelarReservaModal";

const Reservas = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Fecha actual sin hora
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
    const [consultorio, setConsultorio] = useState("1");
    const [reservasExistentes, setReservasExistentes] = useState([]);

    const [precioBase, setPrecioBase] = useState(250);

    // Modales
    const [isReservaModalOpen, setIsReservaModalOpen] = useState(false);
    const [reservaAConfirmar, setReservaAConfirmar] = useState(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [reservaACancelar, setReservaACancelar] = useState(null);

    // Notificaciones
    const [notification, setNotification] = useState({
        isOpen: false,
        type: "info",
        title: "",
        message: "",
    });

    // Estados del modal recurrente (Opción D)
    const [tipoReserva, setTipoReserva] = useState("Ocasional");
    const [recurrenciaTipo, setRecurrenciaTipo] = useState("Semanal");
    const [recurrenciaCantidad, setRecurrenciaCantidad] = useState(1);

    // Lista del usuario
    const [misReservas, setMisReservas] = useState([]);
    const [expandOcasionales, setExpandOcasionales] = useState(false);

    const horarios = generarHorarios();

    const showNotification = (type, title, message) => {
        setNotification({ isOpen: true, type, title, message });
    };

    const closeNotification = () =>
        setNotification({ isOpen: false, type: "info", title: "", message: "" });

    // ---------------------------------------------------
    // PRECIO GLOBAL
    // ---------------------------------------------------
    const cargarPrecioBase = useCallback(async () => {
        const precio = await getPreciosConfig ();
        setPrecioBase(precio);
    }, []);

    useEffect(() => {
        cargarPrecioBase();
    }, [cargarPrecioBase]);

    // ---------------------------------------------------
    // CARGAR RESERVAS DEL DÍA
    // ---------------------------------------------------
    const cargarReservas = useCallback(async () => {
        if (!fechaSeleccionada) return;

        const fechaSinHora = new Date(fechaSeleccionada);
        fechaSinHora.setHours(0, 0, 0, 0);

        // Día pasado → bloquear todo
        if (fechaSinHora < hoy) {
            setReservasExistentes([]);
            return;
        }

        const data = await traerReservas(
            fechaSeleccionada,
            consultorio,
            getIniciales
        );

        setReservasExistentes(data);
    }, [fechaSeleccionada, consultorio]);

    useEffect(() => {
        if (user && fechaSeleccionada) cargarReservas();
    }, [cargarReservas, user, fechaSeleccionada]);

    // ---------------------------------------------------
    // CARGAR MIS RESERVAS
    // ---------------------------------------------------
    useEffect(() => {
        const cargarMisReservas = async () => {
            if (!user?.uid) return;
            const data = await traerReservasUsuario(user.uid);

            const ordenadas = [...data].sort(
                (a, b) =>
                    new Date(`${a.fecha}T${a.horaInicio}`) -
                    new Date(`${b.fecha}T${b.horaInicio}`)
            );
            setMisReservas(ordenadas);
        };
        cargarMisReservas();
    }, [user]);

    // ---------------------------------------------------
    // UTILIDADES
    // ---------------------------------------------------
    const getFechaStr = (fecha) => {
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, "0");
        const day = String(fecha.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const toLocalDateTime = (fecha, hora) => {
        const [year, month, day] = fecha.split("-");
        const [h, m] = hora.split(":");
        return new Date(year, month - 1, day, h, m, 0, 0);
    };

    // ---------------------------------------------------
    // LÓGICA DE HORARIOS
    // ---------------------------------------------------
    const estaOcupado = (horaInicio) => {
        const horario = horarios.find((h) => h.inicio === horaInicio);
        if (!horario) return null;

        const fechaStr = getFechaStr(fechaSeleccionada);

        const inicio = toLocalDateTime(fechaStr, horario.inicio);
        const fin = toLocalDateTime(fechaStr, horario.fin);

        const ahora = new Date();
        const hoyStr = getFechaStr(ahora);

        const fechaSel = new Date(fechaStr + "T00:00:00");

        // 1) Día pasado → bloquea todo
        if (fechaSel < hoy) return { iniciales: "PASADA" };

        // 2) Mismo día → bloquear horarios anteriores al “ahora real”
        if (fechaStr === hoyStr && inicio.getTime() <= ahora.getTime()) {
            return { iniciales: "PASADA" };
        }

        // 3) No permitir pasar de 22:00
        if (fin.getHours() > 22 || (fin.getHours() === 22 && fin.getMinutes() > 0))
            return { iniciales: "REGLA" };

        // 4) Conflictos reales
        return reservasExistentes.find((r) => {
            const rInicio = toLocalDateTime(r.fecha, r.horaInicio);
            const rFin = toLocalDateTime(r.fecha, r.horaFin);
            return inicio < rFin && rInicio < fin;
        });
    };

    // ---------------------------------------------------
    // SELECCIONAR HORARIO
    // ---------------------------------------------------
    const handleReserva = async (horaInicio) => {
        const fechaSinHora = new Date(fechaSeleccionada);
        fechaSinHora.setHours(0, 0, 0, 0);

        if (fechaSinHora < hoy) {
            showNotification("error", "Día no permitido", "No puedes reservar en días pasados.");
            return;
        }

        const ocupado = estaOcupado(horaInicio);
        if (ocupado) {
            const mensajes = {
                PASADA: "Ese horario ya pasó.",
                REGLA: "La reserva no puede terminar después de las 22:00.",
                default: `Horario ocupado por ${ocupado.iniciales}.`,
            };

            showNotification(
                "error",
                "Horario No Disponible",
                mensajes[ocupado.iniciales] || mensajes.default
            );
            return;
        }

        const fecha = getFechaStr(fechaSeleccionada);
        const horario = horarios.find((h) => h.inicio === horaInicio);

        setReservaAConfirmar({
            fecha,
            horaInicio: horario.inicio,
            horaFin: horario.fin,
            consultorio,
            precio: precioBase,
        });

        setIsReservaModalOpen(true);
    };

    // ---------------------------------------------------
    // RESERVAS SEMANA ACTUAL
    // ---------------------------------------------------
    const semanaActual = getISOWeek(new Date());
    const reservasSemana = misReservas.filter(
        (r) => getISOWeek(new Date(r.fecha)) === semanaActual
    );

    // ---------------------------------------------------
    // RENDER
    // ---------------------------------------------------
    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-50 pt-24 p-4">
            <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6 sm:p-8 mb-10">

                {/* HEADER */}
                <div className="mb-6 text-center relative">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="absolute left-0 top-1 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                    >
                        <span className="text-xl">←</span>
                        <span className="text-sm sm:text-base">Volver</span>
                    </button>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-800">
                        Reserva tu <span className="block sm:inline">Consultorio</span>
                    </h2>
                </div>

                {/* CONSULTORIOS */}
                <div className="flex gap-3 mb-6 flex-wrap justify-center">
                    {[1, 2, 3, 4, 5].map((c) => (
                        <button
                            key={c}
                            onClick={() => setConsultorio(c.toString())}
                            className={`px-4 py-2 rounded-lg font-semibold shadow-md
                                ${consultorio === c.toString()
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                }`}
                        >
                            Consultorio {c}
                        </button>
                    ))}
                </div>

                {/* CALENDARIO */}
                <Calendar
                    key={fechaSeleccionada.toISOString() + reservasExistentes.length}
                    fechaSeleccionada={fechaSeleccionada}
                    setFechaSeleccionada={setFechaSeleccionada}
                    reservasExistentes={reservasExistentes}
                    estaOcupado={estaOcupado}
                />

                {/* HORARIOS */}
                {fechaSeleccionada && (
                    <div className="mt-10">
                        <h3 className="text-xl font-bold mb-4 border-b pb-2">
                            Horarios Disponibles — {fechaSeleccionada.toLocaleDateString("es-ES")}
                        </h3>

                        <div className="flex flex-col gap-3">
                            {horarios.map((h, i) => {
                                const ocupado = estaOcupado(h.inicio);
                                const esOcupado = Boolean(ocupado);

                                return (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between p-4 rounded-xl border shadow-sm 
                                            ${esOcupado
                                                ? "bg-red-50 border-red-200"
                                                : "bg-green-50 border-green-300"
                                            }`}
                                    >
                                        <div className="text-gray-800 font-semibold text-sm sm:text-base">
                                            {h.inicio} - {h.fin}
                                        </div>

                                        {esOcupado ? (
                                            <div className="text-red-600 font-semibold text-sm">
                                                {ocupado.iniciales === "REGLA"
                                                    ? "Máx 22:00"
                                                    : ocupado.iniciales === "PASADA"
                                                        ? "Pasado"
                                                        : `Ocupado (${ocupado.iniciales})`}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleReserva(h.inicio)}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg 
                                                    hover:bg-green-700 font-semibold text-sm shadow-md"
                                            >
                                                Reservar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* MIS RESERVAS */}
                <div className="mt-12 border-t pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-blue-900">
                            Mis Reservas (Semana Actual)
                        </h3>

                        <button
                            onClick={() => setExpandOcasionales(!expandOcasionales)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow transition text-sm"
                        >
                            {expandOcasionales ? "Contraer ▲" : "Extender ▼"}
                        </button>
                    </div>

                    {expandOcasionales ? (
                        <div className="space-y-3 animate-slideDown">
                            {reservasSemana.map((r) => {
                                const fechaReserva = toLocalDateTime(r.fecha, r.horaInicio);
                                const ahora = new Date();
                                const puedeCancelar = fechaReserva - ahora > 24 * 60 * 60 * 1000;

                                return (
                                    <div
                                        key={r.id}
                                        className="flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm hover:shadow-md transition"
                                    >
                                        <div>
                                            <p className="font-semibold text-gray-900">
                                                🕒 {r.horaInicio} - {r.horaFin}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {r.fecha} — ${r.precio?.toFixed(2)}
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setReservaACancelar(r);
                                                setIsModalOpen(true);
                                            }}
                                            disabled={!puedeCancelar}
                                            className={`px-3 py-2 rounded-lg text-white text-sm font-semibold shadow 
                                                ${puedeCancelar
                                                    ? "bg-red-600 hover:bg-red-700"
                                                    : "bg-gray-400 cursor-not-allowed"
                                                }`}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm italic ml-1">
                            (Reservas contraídas)
                        </p>
                    )}

                    {reservasSemana.length === 0 && (
                        <p className="text-gray-600 mt-4 text-sm text-center">
                            📆 Esta semana no tienes reservas.
                        </p>
                    )}
                </div>
            </div>

            {/* MODALES */}
            <NotificationModal {...notification} onClose={closeNotification} />

            {isReservaModalOpen && (
                <ConfirmarReservaModal
                    reservaAConfirmar={reservaAConfirmar}
                    tipoReserva={tipoReserva}
                    recurrenciaTipo={recurrenciaTipo}
                    recurrenciaCantidad={recurrenciaCantidad}
                    setTipoReserva={setTipoReserva}
                    setRecurrenciaTipo={setRecurrenciaTipo}
                    setRecurrenciaCantidad={setRecurrenciaCantidad}
                    setIsReservaModalOpen={setIsReservaModalOpen}
                    user={user}
                    showNotification={showNotification}
                    cargarReservas={cargarReservas}
                    actualizarMisReservas={async () => {
                        const nuevas = await traerReservasUsuario(user.uid);
                        setMisReservas(
                            [...nuevas].sort(
                                (a, b) =>
                                    new Date(`${a.fecha}T${a.horaInicio}`) -
                                    new Date(`${b.fecha}T${b.horaInicio}`)
                            )
                        );
                    }}
                />
            )}

            {isModalOpen && (
                <CancelarReservaModal
                    reserva={reservaACancelar}
                    onClose={() => setIsModalOpen(false)}
                    onCancelSuccess={async () => {
                        await cargarReservas();
                        const nuevas = await traerReservasUsuario(user.uid);
                        setMisReservas(
                            [...nuevas].sort(
                                (a, b) =>
                                    new Date(`${a.fecha}T${a.horaInicio}`) -
                                    new Date(`${b.fecha}T${b.horaInicio}`)
                            )
                        );
                    }}
                    showNotification={showNotification}
                />
            )}
        </div>
    );
};

export default Reservas;
