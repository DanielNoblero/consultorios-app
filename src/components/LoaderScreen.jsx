export default function LoaderScreen() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-blue-700 font-semibold text-lg">Cargando...</p>
        </div>
    );
}