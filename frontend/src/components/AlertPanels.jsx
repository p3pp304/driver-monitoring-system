import React from "react";

{/* PANNELLI DATI */}
export default function AlertPanels({ variableX, isSleeping, aiFeedback, routeSuggestion }) {
    return (
        <div className="w-full md:w-1/3 flex flex-col gap-4 text-lg">
          
            {/* 1. Variabile X */}
            <div className={`p-4 rounded-xl ${isSleeping && variableX > 0 ? 'bg-red-900' : 'bg-gray-800'}`}>
                <span className="text-gray-500 text-sm uppercase font-bold">Variabile x (Chiusura)</span>
                <div className="text-4xl font-bold">{variableX} s</div>
            </div>

            {/* 2. Assistente IA */}
            <div className="p-4 bg-gray-800 rounded-xl">
                <span className="text-gray-500 text-sm uppercase font-bold">Assistente IA</span>
                <p className="italic mt-1 break-words">"{aiFeedback}"</p>
            </div>

            {/* 3. Mappe */}
            <div className="p-4 bg-gray-800 rounded-xl">
                <span className="text-gray-500 text-sm uppercase font-bold">Navigazione</span>
                <p className="font-bold mt-1 break-words">
                    {routeSuggestion ? `Il punto di sosta più vicino: ${routeSuggestion.name} (${routeSuggestion.distance_kilometers.toFixed(2)} km)` : "Nessuna deviazione"}
                </p>
                
                {/* Se c'è un suggerimento, mostra il bottone per aprire Maps */}
                {routeSuggestion && routeSuggestion.lat && routeSuggestion.lng && (
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${routeSuggestion.lat},${routeSuggestion.lng}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-3 block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition-colors"
                    >
                        Avvia Navigazione
                    </a>
                )}
            </div>
        </div>
    );
}