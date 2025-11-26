// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
} from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Crea el doc inicial en /usuarios/{uid} si no existe
const ensureUserDoc = async (firebaseUser) => {
    const ref = doc(db, "usuarios", firebaseUser.uid);
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
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // mezcla auth + firestore
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeUserDoc = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (!firebaseUser) {
                if (unsubscribeUserDoc) unsubscribeUserDoc();
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                const userRef = await ensureUserDoc(firebaseUser);

                if (unsubscribeUserDoc) unsubscribeUserDoc();

                unsubscribeUserDoc = onSnapshot(userRef, (snap) => {
                    const data = snap.exists() ? snap.data() : {};

                    setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || null,
                        ...data,
                        isAdmin: data.rol === "admin",
                    });

                    setLoading(false);
                });
            } catch (error) {
                console.error("Error cargando datos del usuario:", error);

                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || null,
                    rol: "usuario",
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

    const register = async (email, password) => {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDoc(cred.user);
    };

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        await ensureUserDoc(cred.user);
    };

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                register,
                login,
                loginWithGoogle,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
