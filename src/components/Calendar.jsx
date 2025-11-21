// src/components/Calendar.jsx
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Calendar({
    fechaSeleccionada,
    setFechaSeleccionada,
    reservasExistentes,
    estaOcupado,
}) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Generar calendario
    const generateCalendar = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();

        let firstDay = new Date(year, month, 1).getDay();
        firstDay = (firstDay === 0 ? 6 : firstDay - 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();

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
        setCurrentMonth(
            new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
        );
    };

    const handleNextMonth = () => {
        setCurrentMonth(
            new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
        );
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

                        const disabled =
                            day < new Date().setHours(0, 0, 0, 0);

                        const isSelected =
                            fechaSeleccionada &&
                            isSameDay(day, fechaSeleccionada);

                        // Marca si el día tiene reservas (basado en día)
                        const tieneReservas = reservasExistentes.some(
                            (r) =>
                                r.fecha === day.toISOString().split("T")[0]
                        );

                        // Clases
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
