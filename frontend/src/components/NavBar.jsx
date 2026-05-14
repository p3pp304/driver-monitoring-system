import React from "react";

export default function NavBar({ techStatus, userStatus, safetyScore, sessionStatus, toggleJourney }) {
  return (
        <header className="mb-8 flex gap-6 justify-between bg-gray-900 p-6 rounded-2xl border border-gray-800">
            {/* 1. OGGETTO A SINISTRA: Il Titolo */}
            <div className="p-1 flex text-center flex-col items-center gap-1">
                <h1 className="p-1 text-center text-3xl font-bold text-blue-400">
                    Driver Monitoring System
                </h1>
                <p className="text-sm text-gray-500 font-medium">{techStatus}</p>
            </div>

            {/* 2. OGGETTO CENTRALE: Safety Score e Stato */}
            <div className="p-1 flex text-center flex-col items-center gap-1">
                <h2 className={`text-3xl font-black ${safetyScore >= 90 ? "text-green-400" : (safetyScore >= 70 ? "text-lime-500" : (safetyScore >= 40 ? "text-orange-500" : "text-red-600"))}`}>
                    Score: {safetyScore}
                </h2>
                <p className="text-sm text-gray-500 font-medium">{userStatus}</p>
            </div>

            {/* 3. OGGETTO A DESTRA: Bottone */}
            <div>
                <button 
                    onClick={toggleJourney}
                    className={`font-bold py-3 px-8 rounded-xl text-lg transition-all shadow-md active:scale-95 ${
                        sessionStatus === "active" ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
                    }`}
                >
                    {sessionStatus === "active" ? "Termina Viaggio" : (sessionStatus === "finished" ? "Nuovo Viaggio" : "Inizia Viaggio")}
                </button>
            </div>
        </header>
    );
}