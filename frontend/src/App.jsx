import React, { useState, useRef } from 'react';
import Navbar from './components/Navbar';


// Importa gli Hook e le Utility
import { useDmsWebSocket } from './hooks/useDmsWebSocket';
import { useMediaPipe } from './hooks/useMediaPipe';
import { speakText, formatTime } from './utils/helpers';

// === COMPONENTE PRINCIPALE ===
export default function App() {
  // Stati UI
  const [sessionStatus, setSessionStatus] = useState("started"); // "started" | "idle" | "active" | "finished" --> interrutore principale dell'app, controlla se siamo in viaggio o no
  const [tripDuration, setTripDuration] = useState(0);  // Tempo totale del viaggio in secondi (calcolato alla fine)
  const [distractionCount, setDistractionCount] = useState(0);  // Conta quante volte il conducente ha commesso errori (sonnolenza) durante il viaggio
  const [userStatus, setUserStatus] = useState("Pronto per la partenza");  // Stato utente semplificato per l'interfaccia (es. "Pronto", "In Viaggio", "Viaggio Terminato")
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiFeedback, setAiFeedback] = useState("Nessuna anomalia rilevata.");
  const [routeSuggestion, setRouteSuggestion] = useState(null); 

  // Riferimenti
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tripStartTimeRef = useRef(null); // <-- Riferimento per l'inizio del viaggio
  // --- RIFERIMENTI GPS ---
  // Coordinate di fallback (es. Politecnico di Bari) in caso di assenza di segnale
  const currentLocationRef = useRef({ lat: 41.1087, lng: 16.8784 }); 
  const watchIdRef = useRef(null); // Serve per spegnere il GPS a fine viaggio


// ---INTEGRAZIONE HOOKS PERSONALIZZATI ---

// 1. WebSocket per comunicazione con il server FastAPI
const { techStatus, sendWsMessage } = useDmsWebSocket(sessionStatus, (data) => {
    // Cosa fare quando riceviamo un messaggio di assistenza proattiva dal server
    setAiFeedback(data.voice_text);
    setRouteSuggestion(data.nearest_rest_stop);
    setSafetyScore(prev => Math.max(0, prev - 10)); // Penalità di 10 punti per ogni distrazione rilevata
    setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni
    speakText(data.voice_text); // Il sistema legge ad alta voce il feedback ricevuto
});

  useEffect(() => {
    if (sessionStatus !== "active") return; // <--- Ferma il timer se non sei in viaggio
    const bonusInterval = setInterval(() => {
      const now = Date.now();
      // Calcola i secondi passati dall'ultimo errore
      const secondsSinceLast = (now - lastDistractionTime.current) / 1000;

      // Se sono passati 600 secondi (10 minuti)
      if (secondsSinceLast >= 600) {
        setSafetyScore(prev => {
          if (prev < 100) {
            return Math.min(100, prev + 5);
          }
          return prev;
        });
        
        // Resetta il timer
        lastDistractionTime.current = Date.now();
      }
    }, 1000); // Il controllo scatta ogni secondo
    return () => clearInterval(bonusInterval);
  }, [sessionStatus]); // <-- Dipendenza dallo stato del viaggio

 

  
  // --- 3. INTERFACCIA MINIMAL ---
  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* HEADER */}
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
          {/* Il Bottone */}
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
      

      {/* DASHBOARD (visibile solo se in attesa o in viaggio) */}
      {sessionStatus !== "finished" && (
        <div className="flex flex-col md:flex-row gap-4 items-start">
        
        {/* WEBCAM E ALLARME */}
        <div className="relative w-full md:w-2/3 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          {sessionStatus === "idle" && (
            <div className="p-2 absolute inset-0 z-10 flex flex-col  text-center items-center justify-center bg-gray-900 text-gray-500 text-2xl font-bold">
              Premi  "Inizia Viaggio" per il monitoraggio in tempo reale
            </div>
          )}
          <video ref={videoRef} className="hidden" playsInline></video>
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

        {/* PANNELLI DATI */}
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
      </div>
      )}

      {/* PANNELLO STATISTICHE FINALI (Appare solo a fine viaggio) */}
      {sessionStatus === "finished" && (
        <div className="mt-8 p-8 bg-gray-900 text-center rounded-2xl border border-gray-700 shadow-2xl">
          <h2 className="text-2xl text-white font-bold mb-6">Riepilogo Sessione di Guida</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 bg-black rounded-xl border border-gray-800">
              <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">Tempo di Guida</div>
              <div className="text-5xl font-black text-blue-400">
                {formatTime(tripDuration)}
              </div>
            </div>

            <div className="p-6 bg-black rounded-xl border border-gray-800">
              <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">Safety Score Finale</div>
              <div className={`text-5xl font-black ${safetyScore >= 90 ? "text-green-400" : (safetyScore >= 70 ? "text-lime-500" : (safetyScore >= 40 ? "text-orange-500" : "text-red-600"))}`}>
                {safetyScore}/100
              </div>
            </div>
            
            <div className="p-6 bg-black rounded-xl border border-gray-800">
              <div className="text-gray-500 text-sm uppercase tracking-widest font-bold mb-2">Eventi di Sonnolenza</div>
              <div className="text-5xl font-black text-red-500">
                {distractionCount}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
