// src/components/ErrorBoundary.jsx
import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("ErrorBoundary capturó:", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
                        <p className="text-4xl mb-4">⚠️</p>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">
                            Algo salió mal
                        </h2>
                        <p className="text-slate-600 text-sm mb-6">
                            Hubo un error cargando la página. Por favor intentá de nuevo.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700"
                        >
                            Recargar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;