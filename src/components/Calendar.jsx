// src/components/Calendar.jsx
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Calendar({
    fechaSeleccionada,
    setFechaSeleccionada,
    reservasExistentes,
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Generar calendario
    const generateCalendar = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();

        let firstDay = new Date(year, month, 1).getDay();
        firstDay = (firstDay === 0 ? 6 : firstDay - 1);

        const weeks = [];
        let day = 1 - firstDay;

        for (let w = 0; w < 6; w++) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                week.push(new Date(year, month, day));
                day++;
            }
            weeks.push(week);
        }
        return weeks;
    };

    const weeks = generateCalendar(currentMonth);

    const isSameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const isToday = (date) => isSameDay(date, new Date());

    const handlePrevMonth = () => {
        const nuevo = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        setCurrentMonth(nuevo);

        // 🔥 Si fechaSeleccionada quedó en un mes pasado → volver a hoy
        const f = new Date(fechaSeleccionada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (f < hoy) {
            setFechaSeleccionada(new Date());
        }
    };

    const handleNextMonth = () => {
        const nuevo = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        setCurrentMonth(nuevo);

        const f = new Date(fechaSeleccionada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (f < hoy) {
            setFechaSeleccionada(new Date());
        }
    };

    return (
        <div className="w-full bg-white p-4 rounded-xl shadow-md border">

            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={handlePrevMonth}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                <h2 className="text-xl font-bold text-gray-800 capitalize">
                    {currentMonth.toLocaleString("es-ES", {
                        month: "long",
                        year: "numeric",
                    })}
                </h2>

                <button
                    onClick={handleNextMonth}
                    className="p-2 hover:bg-gray-200 rounded-lg"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 text-center font-semibold text-gray-600 mb-2">
                {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <div key={i}>{d}</div>
                ))}
            </div>

            {/* Calendar */}
            <div className="grid grid-cols-7 gap-2 text-center">
                {weeks.map((week, wi) =>
                    week.map((day, di) => {
                        const isCurrentMonth =
                            day.getMonth() === currentMonth.getMonth();

                        const hoy = new Date();
                        hoy.setHours(0, 0, 0, 0);
                        const disabled = day < hoy;  // 🔥 OPCIÓN A: días pasados bloqueados

                        const isSelected =
                            fechaSeleccionada && isSameDay(day, fechaSeleccionada);

                        const fechaStr = day.toISOString().split("T")[0];
                        const tieneReservas =
                            reservasExistentes.length > 0 &&
                            reservasExistentes.some((r) => r.fecha === fechaStr);

                        // Clases visuales (NO TOCO TU CSS)
                        const classes = `
                            p-2 rounded-lg text-sm font-semibold transition cursor-pointer
                            ${!isCurrentMonth ? "text-gray-400" : ""}
                            ${disabled ? "opacity-40 cursor-not-allowed" : ""}
                            ${isToday(day) ? "ring-2 ring-blue-400" : ""}
                            ${isSelected ? "bg-blue-600 text-white ring-2 ring-blue-800" : ""}
                            ${tieneReservas && isCurrentMonth
                                ? "bg-red-400 text-white"
                                : "bg-green-200 text-gray-800"
                            }
                        `;

                        return (
                            <div
                                key={`${wi}-${di}`}
                                className={classes}
                                onClick={() => {
                                    if (!disabled) setFechaSeleccionada(day);
                                }}
                            >
                                {day.getDate()}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
