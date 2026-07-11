// src/context/AuthContext.jsx
// =============================================
// CONTEXTO DE AUTENTICACIÓN OPTIMIZADO
// - Unifica usuario de Firebase Auth + Firestore
// - Crea /usuarios/{uid} si no existe
// - Expone: user, loading, register, login, loginWithGoogle, logout
// =============================================

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
} from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// 🟦 Instancia única del provider de Google (no se recrea en cada render)
const googleProvider = new GoogleAuthProvider();

// 🟦 Detectar si es un navegador mobile (popup falla ahí, redirect funciona bien)
const esMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// =====================================================
// ensureUserDoc
// - Garantiza que exista /usuarios/{uid} con datos básicos
// - Se usa tanto en onAuthStateChanged como en los logins
// =====================================================
const ensureUserDoc = async (firebaseUser) => {
    const ref = doc(db, "usuarios", firebaseUser.uid);

    try {
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, {
                email: firebaseUser.email,
                rol: "psicologo",
                perfilCompleto: false,
                createdAt: new Date().toISOString(),
            });
        }

        return ref;
    } catch (error) {
        console.error("Error en ensureUserDoc:", error);
        // En caso de error igual devolvemos la referencia para no romper el flujo
        return ref;
    }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // mezcla Auth + Firestore
    const [loading, setLoading] = useState(true);

    // 🔹 Capturar el resultado del login por redirect (mobile)
    useEffect(() => {
        getRedirectResult(auth)
            .then(async (result) => {
                if (result?.user) {
                    await ensureUserDoc(result.user);
                }
            })
            .catch((error) => {
                console.error("Error en redirect de Google:", error);
            });
    }, []);

    useEffect(() => {
        let unsubscribeUserDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            // 🔹 No hay usuario autenticado
            if (!firebaseUser) {
                if (unsubscribeUserDoc) unsubscribeUserDoc();
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // 🔹 Asegurar doc en /usuarios/{uid}
                const userRef = await ensureUserDoc(firebaseUser);

                // Cortar listener anterior si existía
                if (unsubscribeUserDoc) unsubscribeUserDoc();

                // 🔹 Suscripción en tiempo real al doc del usuario
                unsubscribeUserDoc = onSnapshot(
                    userRef,
                    (snap) => {
                        const data = snap.exists() ? snap.data() : {};

                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || null,
                            ...data,
                            isAdmin: data.rol === "admin",
                        });

                        setLoading(false);
                    },
                    (error) => {
                        console.error("Error en onSnapshot usuario:", error);

                        // Fallback mínimo para no dejar al usuario colgado
                        setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || null,
                            rol: "psicologo",
                            perfilCompleto: false,
                            isAdmin: false,
                        });

                        setLoading(false);
                    }
                );
            } catch (error) {
                console.error("Error cargando datos del usuario:", error);

                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || null,
                    rol: "psicologo",
                    perfilCompleto: false,
                    isAdmin: false,
                });

                setLoading(false);
            }
        });

        return () => {
            if (unsubscribeUserDoc) unsubscribeUserDoc();
            unsubscribeAuth();
        };
    }, []);

    // =====================================================
    // MÉTODOS PÚBLICOS
    // =====================================================
    const register = async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(cred.user);
    };

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    // ✅ Fix: usa redirect en mobile (popup falla en Chrome Android/iOS),
    // y popup en desktop (mejor UX, no saca al usuario de la pestaña)
    const loginWithGoogle = async () => {
        if (esMobile()) {
            await signInWithRedirect(auth, googleProvider);
            // El resultado se procesa en el useEffect de getRedirectResult
        } else {
            const cred = await signInWithPopup(auth, googleProvider);
            await ensureUserDoc(cred.user);
        }
    };

    const logout = () => signOut(auth);

    // =====================================================
    // value MEMOIZADO → menos renders en toda la app
    // =====================================================
    const value = useMemo(
        () => ({
            user,
            loading,
            register,
            login,
            loginWithGoogle,
            logout,
        }),
        [user, loading]
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};