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
const { techStatus, sendWsMessage } = useDmsWebSocket(sessionStatus, (response) => {
    // Cosa fare quando riceviamo un messaggio di assistenza proattiva dal server
    setAiFeedback(response.voice_text);
    setRouteSuggestion(response.nearest_rest_stop);
    setSafetyScore(prev => Math.max(0, prev - response.penalty)); // Penalità variabile per ogni distrazione rilevata
    setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni
    speakText(response.voice_text); // Il sistema legge ad alta voce il feedback ricevuto
});

// 2. MediaPipe per il monitoraggio in tempo reale del conducente
const { isSleeping, variableX } = useMediaPipe(videoRef, canvasRef, sessionStatus, (timeClosed) => {
    // Invia un messaggio al server per notificare l'allarme di sonnolenza
  sendWsMessage({ 
      event: "DROWSINESS_ALERT", 
      variable_x: timeClosed,
      location: currentLocationRef.current, // Invia anche la posizione attuale del conducente
    }); 
});

//FUNZIONI DI SUPPORTO(a toggleJourney)

// Accensione e spegnimento GPS (per monitoraggio continuo durante il viaggio)
const startGPSMonitoring = () => {
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => currentLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      );
    }
  };

  const stopGPSMonitoring = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current); // 
      watchIdRef.current = null; 
    }
  };

  // Feedback finale a fine viaggio basato sul punteggio di sicurezza
const playEndJourneyFeedback = (score) => {
  if (score >= 90) speakText("Viaggio terminato. Ottimo lavoro, hai mantenuto un punteggio di sicurezza elevato.");
  else if (score >= 70) speakText("Viaggio terminato. Buon lavoro, ma cerca di evitare distrazioni per un punteggio più alto.");
  else if (score >= 40) speakText("Viaggio terminato. Attenzione, il tuo punteggio di sicurezza è basso.");
  else speakText("Viaggio terminato. Punteggio molto basso. Presta maggiore attenzione alla guida per la tua sicurezza.");
};


// --- FUNZIONE INTERRUTTORE (IMPORTANTE) ---
const toggleJourney = () => {
    if (sessionStatus === "idle") {
        // INIZIA IL VIAGGIO
        setSafetyScore(100);
        setDistractionCount(0);
        setVariableX(0);
        setTripDuration(0);
        setAiFeedback("Nessuna anomalia rilevata.");
        setRouteSuggestion(null);
        setSessionStatus("active");
        // LOGICA A DOPPIO STATUS
        setUserStatus("In Viaggio");
        
        speakText("Buon viaggio, guida con prudenza."); // Il sistema saluta il guidatore a voce

        tripStartTimeRef.current = Date.now(); // Fa partire il timer
        lastDistractionTime.current = Date.now(); 
        startGPSMonitoring(); // Accende il GPS

} else if (sessionStatus === "active") {
    // TERMINA IL VIAGGIO --> LOGICA A DOPPIO STATUS
    setSessionStatus("finished");
    playEndJourneyFeedback(safetyScore);
    setUserStatus("Viaggio Terminato");
    stopGPSMonitoring(); // Spegne il GPS a fine viaggio
    // Calcola i secondi totali trascorsi dall'inizio
    if (tripStartTimeRef.current) {
        const totalSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
        setTripDuration(totalSeconds);
    }
}else if(sessionStatus === "finished") {
    // RESETTA PER UN NUOVO VIAGGIO
    setSessionStatus("idle");
    setSafetyScore(100);
    setVariableX(0);
    setAiFeedback("Nessuna anomalia rilevata.");
    setRouteSuggestion(null);
    // LOGICA A DOPPIO STATUS
    speakText("Premi il pulsante per il monitoraggio in tempo reale");
    setUserStatus("Pronto per la partenza");
}
};



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
      <Navbar 
        techStatus={techStatus} 
        userStatus={userStatus} 
        safetyScore={safetyScore} 
        sessionStatus={sessionStatus} 
        toggleJourney={toggleJourney} 
      />  

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
