import React from "react";

{/* PANNELLI DATI */}
export default function AlertPanels({ variableX, isSleeping, aiFeedback, routeSuggestion }) {

    const [isMapVisible, setIsMapVisible] = useState(false);
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
                <p className=" mt-1">{aiFeedback}</p>
            </div>

            {/* 3. Mappe */}
            <div className="p-4 bg-gray-800 rounded-xl">
                <span className="text-gray-500 text-sm uppercase font-bold">Navigazione</span>
                <p className="font-bold mt-1 break-words">
                    {routeSuggestion ? `La zona di sosta più vicina: ${routeSuggestion.name} (${routeSuggestion.distance_kilometers.toFixed(2)} km)` : "Nessuna deviazione"}
                </p>
                
                {/* Se c'è un suggerimento, mostra il bottone per aprire Maps */}
                {routeSuggestion && routeSuggestion.lat && routeSuggestion.lng && (
                    <>
                    {/* Bottone Toggle per mostrare/nascondere la mappa */}
                    <button 
                        onClick={() => setIsMapVisible(!isMapVisible)}
                        className="mt-3 block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg transition-colors cursor-pointer"
                    >
                        {isMapVisible ? "Nascondi Mappa" : "Mostra Mappa"}
                    </button>

                    {/* 4. Rendering Condizionale dell'iFrame */}
                    {isMapVisible && (
                        <div className="mt-3 h-[250px] w-full rounded-lg overflow-hidden border border-gray-600">
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${routeSuggestion.lat},${routeSuggestion.lng}&hl=it&z=15&output=embed`}
                                allowFullScreen
                                title="Google Maps Safe Zone"
                            ></iframe>
                        </div>
                    )}
                    </>
                )}
            </div>
        </div>
    );
}