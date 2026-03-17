import React, { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState("Connessione in corso...");
  const [variableX, setVariableX] = useState(0);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws');

    socket.onopen = () => setStatus("Sistema Attivo");
    socket.onmessage = (event) => {
      console.log("Dati DMS:", event.data);
      // Qui aggiorneremo il valore della variabile x
    };
    socket.onclose = () => setStatus("Offline");

    return () => socket.close();
  }, []);

  return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center p-8" },
    
    // Titolo
    React.createElement('h1', { className: "text-4xl font-bold text-blue-400 mb-8 tracking-wide" }, 
      "DMS - Driver Monitoring System"
    ),
    
    // Contenitore delle Card
    React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-10" },
      
      // Card 1: Stato
      React.createElement('div', { className: "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center" },
        React.createElement('span', { className: "text-slate-400 text-sm uppercase tracking-wider mb-2" }, "Stato Sensore"),
        React.createElement('span', { className: `text-2xl font-semibold ${status === "Sistema Attivo" ? "text-green-400" : "text-yellow-400"}` }, status)
      ),

      // Card 2: Variabile x
      React.createElement('div', { className: "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center" },
        React.createElement('span', { className: "text-slate-400 text-sm uppercase tracking-wider mb-2" }, "Variabile x (Chiusura Occhi)"),
        React.createElement('div', { className: "text-4xl font-mono font-bold text-white" }, 
          variableX, 
          " ", 
          React.createElement('span', { className: "text-lg text-slate-500" }, "sec")
        )
      )
    ),

    // Riquadro Video
    React.createElement('div', { className: "w-full max-w-3xl aspect-video bg-black rounded-3xl border-4 border-slate-800 flex items-center justify-center" },
      React.createElement('p', { className: "text-slate-500 italic" }, "Streaming Webcam (Prossima Fase)")
    )
  );
}

export default App;