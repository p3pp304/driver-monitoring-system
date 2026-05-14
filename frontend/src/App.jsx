import React, { useState, useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { 
  calculate_ear, 
  speakText, 
  formatTime, 
  playAlertBeep, 
  LEFT_EYE, 
  RIGHT_EYE, 
  EAR_THRESHOLD, 
  X_SLEEP_THRESHOLD 
} from './utils/helpers';

// --- INIZIALIZZAZIONE MEDIA PIPE ---
// Utilizziamo FaceMesh per estrarre 468 landmark facciali in tempo reale.
// refine_landmarks=True migliora la precisione attorno a occhi e labbra


// === COMPONENTE PRINCIPALE ===
export default function App() {
  // Stati UI
  const [sessionStatus, setSessionStatus] = useState("started"); // "started" | "idle" | "active" | "finished" --> interrutore principale dell'app, controlla se siamo in viaggio o no
  const [tripDuration, setTripDuration] = useState(0);  // Tempo totale del viaggio in secondi (calcolato alla fine)
  const [distractionCount, setDistractionCount] = useState(0);  // Conta quante volte il conducente ha commesso errori (sonnolenza) durante il viaggio
  const [userStatus, setUserStatus] = useState("Pronto per la partenza");  // Stato utente semplificato per l'interfaccia (es. "Pronto", "In Viaggio", "Viaggio Terminato")
  const [techStatus, setTechStatus] = useState("Sistema di monitoraggio attivo");  // Stato tecnico dettagliato per debugging (non mostrato all'utente finale, ma utile durante lo sviluppo)
  const [variableX, setVariableX] = useState(0); // Tempo di chiusura occhi in secondi
  const [isSleeping, setIsSleeping] = useState(false);  // Stato di allarme per chiusura occhi
  
  // Stati Proattivi
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiFeedback, setAiFeedback] = useState("Nessuna anomalia rilevata.");
  const [routeSuggestion, setRouteSuggestion] = useState(null); 

  // Riferimenti
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const cameraRef = useRef(null);
  const closedStartTimeRef = useRef(null);
  const lastAlarmTimeRef = useRef(0);
  const lastDistractionTime = useRef(0); // <-- 1. Traccia l'orario dell'ultimo errore
  const tripStartTimeRef = useRef(null); // <-- Riferimento per l'inizio del viaggio
  // --- RIFERIMENTI GPS ---
  // Coordinate di fallback (es. Politecnico di Bari) in caso di assenza di segnale
  const currentLocationRef = useRef({ lat: 41.1087, lng: 16.8784 }); 
  const watchIdRef = useRef(null); // Serve per spegnere il GPS a fine viaggio



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

  // --- 1. WEBSOCKET ---
  useEffect(() => {   // Stabilisce la connessione WebSocket al backend FastAPI; viene eseguito una sola volta all'avvio di App
    
    if (sessionStatus !== "active") return;  // BLOCCO: Ferma tutto se il viaggio non è "active" (ovvero se è "idle" o "finished"). In questo modo, se l'utente preme il pulsante per iniziare il viaggio, allora si stabilisce la connessione WebSocket e si avviano i sensori. Se invece preme per terminare, la connessione si chiude e i sensori si fermano (grazie alla pulizia del useEffect).

    wsRef.current = new WebSocket('ws://localhost:8000/ws');  
    wsRef.current.onopen = () => {
      setTechStatus("Connesso al server");
      console.log("[NETWORK] Handshake WebSocket completato sulla porta 8000."); 
    };
    wsRef.current.onclose = () => {
      setTechStatus("Disconnesso al server");
      console.log("[NETWORK] Canale WebSocket chiuso.");
    }; 
    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === "PROACTIVE_ASSISTANCE") {
        setAiFeedback(response.voice_text);  // Aggiorna il feedback dell'assistente IA con il testo ricevuto dal server
        setRouteSuggestion(response.maps_route); 
        speakText(response.voice_text + (response.maps_route ? ` Attenzione, ti suggerisco di fermarti al punto di sosta più vicino: ${response.maps_route.name}, a ${response.maps_route.distance_kilometers.toFixed(2)} chilometri da qui.` : " Non sono state rilevate deviazioni necessarie al momento. Continua a guidare con prudenza."));
        setSafetyScore(prev => Math.max(0, prev - response.penalty)); // Applica la penalità al punteggio di sicurezza, assicurandosi che non scenda sotto 0
        setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni (errori) 
        lastDistractionTime.current = Date.now();  // Aggiorna l'orario dell'ultimo errore
      }
      
    };
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [sessionStatus]);

    // --- 2. MEDIAPIPE (EDGE COMPUTING) ---
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return; // Sicurezza: se i riferimenti alla webcam o al canvas non sono pronti, esci dalla funzione
    const canvasCtx = canvasRef.current.getContext('2d');  // Ottieni il contesto 2D del canvas per poter disegnare sopra la webcam

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });  //

    faceMesh.onResults((results) => {
      // Disegna la webcam e i landmark (se presenti)
      canvasCtx.clearRect(0, 0, 1280, 720);
      if (results.image) canvasCtx.drawImage(results.image, 0, 0, 1280, 720);
      
      if (results.multiFaceLandmarks?.[0]) {    // [0] perché stiamo monitorando solo un volto (il conducente); '?.' per sicurezza non blocca il programma se non rileva volti
        const landmarks = results.multiFaceLandmarks[0];
        const ear = (calculate_ear(landmarks, LEFT_EYE) + calculate_ear(landmarks, RIGHT_EYE)) / 2;

        if (ear < EAR_THRESHOLD && sessionStatus === "active") {  // Se l'EAR è sotto la soglia e siamo in viaggio, considera gli occhi chiusi{
          if (!closedStartTimeRef.current) {
           closedStartTimeRef.current = performance.now();}
          
          const timeClosed = (performance.now() - closedStartTimeRef.current) / 1000;  // tempo da millisecondi a secondi
          setVariableX(timeClosed.toFixed(2));
          setIsSleeping(true);
          
          // Allarme se il tempo di chiusura supera la soglia e non abbiamo suonato l'allarme negli ultimi 2 secondi (2000ms, per evitare spam)
          if (timeClosed > X_SLEEP_THRESHOLD && (performance.now() - lastAlarmTimeRef.current > 2000)) {
            new Audio('/beep.mp3').play();   // Suona il file MP3
            // Invia dati al server;
            wsRef.current?.send(JSON.stringify({
              event: "DROWSINESS_DETECTED",
              variable_x: timeClosed.toFixed(2),
              location: currentLocationRef.current || { lat: 41.1087, lng: 16.8784 } // Invia anche le coordinate GPS attuali al server per un possibile intervento proattivo
            }));
            lastAlarmTimeRef.current = performance.now();
          }
        } else {
          // Azzera tutto se apre gli occhi
          closedStartTimeRef.current = null;
          setVariableX(0);
          setIsSleeping(false);
        }
      }
    });

    // Avvia Webcam
    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => await faceMesh.send({ image: videoRef.current }),
      width: 1280, height: 720
    });
    cameraRef.current.start();

    // Pulizia allo spegnimento
    return () => {
      if (cameraRef.current) cameraRef.current.stop();
      if (wsRef.current) wsRef.current.close();
      faceMesh.close();
    };
  }, [sessionStatus]); // <-- Dipendenza dallo stato del viaggio

  // --- 3. IL TIMER DEL BONUS ---
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
