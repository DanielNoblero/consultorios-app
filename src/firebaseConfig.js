// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyD9trmZZvtBDk4FFJPdU4EFm6ffpkRnVEc",
    authDomain: "consultorio-4e6c5.firebaseapp.com",
    projectId: "consultorio-4e6c5",
    storageBucket: "consultorio-4e6c5.appspot.com", // ← 🔥 CORREGIDO
    messagingSenderId: "399757104061",
    appId: "1:399757104061:web:041a12ff17e3592a7378d4",
    measurementId: "G-DTDGQ9YL9T",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export { app };
