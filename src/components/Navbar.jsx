import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

import Logo from "../assets/Logo.png";

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [role, setRole] = useState(null);
    const [isProfileComplete, setIsProfileComplete] = useState(false);
    const [ready, setReady] = useState(false);

    const menuRef = useRef(null); // ⭐ para click afuera
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Detectar datos del usuario
    useEffect(() => {
        const loadUserData = async () => {
            if (!user) {
                setRole(null);
                setIsProfileComplete(false);
                setReady(true);
                return;
            }

            try {
                const ref = doc(db, "usuarios", user.uid);
                const snap = await getDoc(ref);

                if (snap.exists()) {
                    const data = snap.data();
                    setRole(data.rol || "usuario");
                    setIsProfileComplete(!!data.perfilCompleto);
                }
            } catch {
                setRole("usuario");
                setIsProfileComplete(false);
            }

            setReady(true);
        };

        loadUserData();
    }, [user]);

    // ⭐ Cerrar menú con scroll
    useEffect(() => {
        const closeMenu = () => setIsOpen(false);
        window.addEventListener("scroll", closeMenu);

        return () => window.removeEventListener("scroll", closeMenu);
    }, []);

    // ⭐ Detectar click afuera del menú mobile
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    const handleLogout = async () => {
        try {
            await logout();
            setIsOpen(false);
            navigate("/login");
        } catch (err) {
            console.error(err);
        }
    };

    if (!ready) {
        return (
            <div className="text-center py-4 text-blue-700 font-semibold">
                Preparando tu sesión...
            </div>
        );
    }

    const linkBase =
        "bg-white text-blue-700 hover:bg-gray-100 px-4 py-2 rounded-lg font-semibold transition shadow";

    return (
        <header className="w-full relative z-50 shadow-lg">
            <nav className="bg-[#e9f4ff] shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">

                    {/* LOGO */}
                    <Link to="/" className="flex items-center gap-3">
                        <img
                            src={Logo}
                            alt="Logo"
                            className="w-9 h-20 object-contain drop-shadow-md"
                        />
                        <span className="text-sky-800 font-extrabold text-xl tracking-wide">
                            Analyse
                        </span>
                    </Link>

                    {/* --- DESKTOP --- */}
                    <div className="hidden md:flex items-center space-x-6">

                        {user && isProfileComplete && (
                            <>
                                <Link to="/reservas" className={linkBase}>
                                    Reservar
                                </Link>

                                {role === "admin" && (
                                    <Link
                                        to="/admin"
                                        className="px-4 py-2 bg-yellow-200 text-yellow-900 font-semibold rounded-lg border border-yellow-400 shadow-sm hover:bg-yellow-300 transition"
                                    >
                                        Admin
                                    </Link>
                                )}
                            </>
                        )}

                        {user ? (
                            <>
                                <Link to="/perfil" className={linkBase}>Mi Perfil</Link>

                                <button
                                    onClick={handleLogout}
                                    className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-white font-semibold shadow transition"
                                >
                                    Cerrar sesión
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className={linkBase}>Login</Link>
                                <Link to="/register" className={linkBase}>Registro</Link>
                            </>
                        )}
                    </div>

                    {/* --- MOBILE HAMBURGER --- */}
                    <button
                        className="md:hidden text-sky-800 hover:text-gray-200"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* --- MOBILE MENU WITH SLIDEDOWN + CLICK OUTSIDE --- */}
                {isOpen && (
                    <div
                        ref={menuRef}
                        className="md:hidden animate-slideDown origin-top"
                    >
                        <div className="bg-[#d8e9ff] shadow-md rounded-b-xl px-4 py-4 border-t border-blue-200">

                            <div className="flex flex-col space-y-2 text-blue-900 font-semibold">
                                {user && isProfileComplete && (
                                    <>
                                        <Link
                                            to="/reservas"
                                            onClick={() => setIsOpen(false)}
                                            className="w-full text-center py-2 bg-white/70 hover:bg-white rounded-lg transition shadow-sm"
                                        >
                                            Reservar
                                        </Link>

                                        {role === "admin" && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsOpen(false)}
                                                className="w-full text-center py-2 bg-white/70 hover:bg-white rounded-lg transition shadow-sm"
                                            >
                                                Admin
                                            </Link>
                                        )}
                                    </>
                                )}

                                {user ? (
                                    <>
                                        <Link
                                            to="/perfil"
                                            onClick={() => setIsOpen(false)}
                                            className="w-full text-center py-2 bg-white/70 hover:bg-white rounded-lg transition shadow-sm"
                                        >
                                            Mi Perfil
                                        </Link>

                                        <button
                                            onClick={handleLogout}
                                            className="w-full mt-1 bg-red-500 hover:bg-red-600 py-2 rounded-lg text-white font-semibold shadow-sm transition"
                                        >
                                            Cerrar sesión
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setIsOpen(false)}
                                            className="w-full text-center py-2 bg-white/70 hover:bg-white rounded-lg transition shadow-sm"
                                        >
                                            Login
                                        </Link>

                                        <Link
                                            to="/register"
                                            onClick={() => setIsOpen(false)}
                                            className="w-full text-center py-2 bg-white/70 hover:bg-white rounded-lg transition shadow-sm"
                                        >
                                            Registro
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </nav>
        </header>
    );
}
