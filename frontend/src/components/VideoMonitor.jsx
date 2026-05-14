import react from "react";
import {X_SLEEP_THRESHOLD} from "../utils/helpers.js";

{/* MONITOR VIDEO */}
export default function VideoMonitor({ videoRef, canvasRef, isSleeping, variableX, sessionStatus }) {
    return (
        <div className="relative w-full md:w-2/3 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">

            {sessionStatus === "idle" && (
                <div className="p-2 absolute inset-0 z-10 flex flex-col  text-center items-center justify-center bg-gray-900 text-gray-500 text-2xl font-bold">
                    Premi  "Inizia Viaggio" per il monitoraggio in tempo reale
                </div>
            )}

            {/*WEBCAM*/}
            <video ref={videoRef} className="hidden" playsInline></video>

            {/*CANVAS*/}
            <canvas 
                ref={canvasRef} 
                width="1280" 
                height="720"
                className="w-full h-full transform -scale-x-100 object-cover rounded-2xl" 
            ></canvas>

            {/* OVERLAY ALLARME */}
            {isSleeping && variableX > X_SLEEP_THRESHOLD && sessionStatus === "active" && (
                <div className="absolute inset-0 bg-red-600 flex items-center justify-center animate-pulse">
                    <span className="text-white text-7xl font-black ">ALLARME!</span>
                </div>
            )}
        </div>
    );
}   