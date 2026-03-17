import React, { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState("Connessione in corso...");
  const [variableX, setVariableX] = useState(0);

  useEffect(() => {  // Effettua la connessione WebSocket quando il componente viene montato
    const socket = new WebSocket('ws://localhost:8000/ws');

    socket.onopen = () => setStatus("Sistema Attivo");
    socket.onmessage = (event) => {
      console.log("Dati DMS:", event.data);
      // Qui aggiorneremo il valore della variabile x
    };
    socket.onclose = () => setStatus("Offline");

    return () => socket.close(); // Chiude la connessione WebSocket quando il componente viene smontato
  }, []);  // []--> Effettua la connessione WebSocket una sola volta all'avvio del componente

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      
      {/* Titolo */}
      <h1 className="text-4xl font-bold text-blue-400 mb-8 tracking-wide">
        DMS - Driver Monitoring System
      </h1>
      
      {/* Contenitore delle Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-10">
        
        {/* Card 1: Stato */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase tracking-wider mb-2">
            Stato Sensore
          </span>
          <span className={`text-2xl font-semibold ${status === "Sistema Attivo" ? "text-green-400" : "text-yellow-400"}`}>
            {status}
          </span>
        </div>

        {/* Card 2: La tua Variabile x */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase tracking-wider mb-2">
            Variabile x (Chiusura Occhi)
          </span>
          <div className="text-4xl font-mono font-bold text-white">
            {variableX} <span className="text-lg text-slate-500">sec</span>
          </div>
        </div>
        
      </div>

      {/* Riquadro Video */}
      <div className="w-full max-w-3xl aspect-video bg-black rounded-3xl border-4 border-slate-800 flex items-center justify-center">
        <p className="text-slate-500 italic">
          Streaming Webcam (Prossima Fase)
        </p>
      </div>
      
    </div>
  );
}

export default App;