import React from 'react'

export default function SummaryScreen({ tripDuration, safetyScore, distractionCount, formatTime }) {
    return (
        <div className="mt-8 p-8 bg-gray-900 text-center rounded-2xl border border-gray-700 shadow-2xl">
            <h2 className="text-2xl text-white font-bold mb-6">Riepilogo Sessione di Guida</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="p-6 bg-black rounded-xl border border-gray-800">
                    <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">
                        Tempo di Guida
                    </div>
                    <div className="text-5xl font-black text-blue-400">
                        {formatTime(tripDuration)}
                    </div>
                </div>

                <div className="p-6 bg-black rounded-xl border border-gray-800">
                    <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">
                        Safety Score Finale
                    </div>
                    <div className={`text-5xl font-black ${safetyScore >= 90 ? "text-green-400" : (safetyScore >= 70 ? "text-lime-500" : (safetyScore >= 40 ? "text-orange-500" : "text-red-600"))}`}>
                        {safetyScore}/100
                    </div>
                </div>
                
                <div className="p-6 bg-black rounded-xl border border-gray-800">
                    <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">
                        Eventi di Sonnolenza
                    </div>
                    <div className="text-5xl font-black text-red-500">
                        {distractionCount}
                    </div>
                </div>

            </div>
        </div>
    );
}