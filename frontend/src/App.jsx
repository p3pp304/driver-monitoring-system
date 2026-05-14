import React, { useState, useRef, useEffect } from 'react';

// Import Componenti
import Navbar from './components/NavBar';
import VideoMonitor from './components/VideoMonitor';
import AlertPanels from './components/AlertPanels';
import SummaryScreen from './components/SummaryScreen';

// Importa gli Hook e le funzioni utils
import { useDmsWebSocket } from './hooks/useDmsWebSocket';
import { useMediaPipe } from './hooks/useMediaPipe';
import { speakText, formatTime} from './utils/helpers';

// === COMPONENTE PRINCIPALE ===

export default function App() {
  // ---1. STATI---
  const [sessionStatus, setSessionStatus] = useState("started"); // "started" | "idle" | "active" | "finished" --> interrutore principale dell'app, controlla se siamo in viaggio o no
  const [tripDuration, setTripDuration] = useState(0);  // Tempo totale del viaggio in secondi (calcolato alla fine)
  const [distractionCount, setDistractionCount] = useState(0);  // Conta quante volte il conducente ha commesso errori (sonnolenza) durante il viaggio
  const [userStatus, setUserStatus] = useState("Pronto per la partenza");  // Stato utente semplificato per l'interfaccia (es. "Pronto", "In Viaggio", "Viaggio Terminato")
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiFeedback, setAiFeedback] = useState("Nessuna anomalia rilevata.");
  const [routeSuggestion, setRouteSuggestion] = useState(null); 

  // ---2. RIFERIMENTI---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tripStartTimeRef = useRef(null); // <-- Riferimento per l'inizio del viaggio
  const lastDistractionTime = useRef(null); // <-- Riferimento per l'ultimo errore (usato per bonus di sicurezza)
  // riferimenti GPS 
  // Coordinate di fallback (es. Politecnico di Bari) in caso di assenza di segnale
  const currentLocationRef = useRef({ lat: 41.1087, lng: 16.8784 }); 
  const watchIdRef = useRef(null); // Serve per spegnere il GPS a fine viaggio


  // ---3. HOOKS PERSONALIZZATI---

      // 1. WebSocket per comunicazione con il server FastAPI
  const { techStatus, sendWsMessage } = useDmsWebSocket(sessionStatus, (response) => {
      // Cosa fare quando riceviamo un messaggio di assistenza proattiva dal server
      setAiFeedback(response.voice_text);
      setRouteSuggestion(response.maps_route);
      setSafetyScore(prev => Math.max(0, prev - response.penalty)); // Penalità variabile per ogni distrazione rilevata
      setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni
      lastDistractionTime.current = Date.now(); // Resetta il timer per il bonus di sicurezza
      speakText(response.voice_text + " La zona di sosta più vicina è: " + response.maps_route.name + "a " + response.maps_route.distance_kilometers + " chilometri"); // Il sistema legge ad alta voce il feedback ricevuto + eventuale suggerimento di percorso
  });

      // 2. MediaPipe per il monitoraggio in tempo reale del conducente
  const { isSleeping, variableX } = useMediaPipe(videoRef, canvasRef, sessionStatus, (timeClosed) => {
      // Invia un messaggio al server per notificare l'allarme di sonnolenza
    sendWsMessage({ 
        event: "DROWSINESS_DETECTED", 
        variable_x: timeClosed,
        location: currentLocationRef.current, // Invia anche la posizione attuale del conducente
      }); 
  });

  // --- 4. LOGICA DI BENVENUTO INIZIALE ---
  useEffect(() => {
    if (sessionStatus === "started") {
      // Il sistema parla solo una volta all'avvio
      speakText("Benvenuto, io sono il tuo assistente virtuale di guida. Premi il pulsante Inizia Viaggio per attivare il monitoraggio in tempo reale.");
      
      // Passa immediatamente allo stato di attesa
      setSessionStatus("idle");
    }
  }, [sessionStatus]);

// --- 5. LOGICA DEL BONUS ---
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
  const playEndJourneyFeedback = (score, distractionCount) => {
    const intro = "Viaggio terminato. ";
    let messaggio = "";

    if (x >= 90) {
        messaggio = "Guida eccellente. Hai mantenuto un livello di attenzione ottimale per tutto il tragitto. Ottimo lavoro.";
    } else if (x >= 70) {
        messaggio = "Buona guida, ma c'è margine di miglioramento. Cerca di ridurre le distrazioni minori per mantenere sempre la massima concentrazione.";
    } else if (x >= 40) {
        messaggio = `Attenzione: ho rilevato ${distractionCount} distrazioni durante il percorso. Ti invito a mantenere sempre lo sguardo sulla strada per viaggiare in totale sicurezza.`;
    } else {
        messaggio = `Livello di attenzione critico. Sono state registrate ben ${distractionCount} distrazioni o segni di sonnolenza. Per la tua incolumità, ti consiglio di fare una pausa prima del prossimo viaggio.`;
    }

    speakText(intro + messaggio);
  };

  const toggleJourney = () => {
    if (sessionStatus === "idle") {
        // INIZIA IL VIAGGIO
        setSafetyScore(100);
        setDistractionCount(0);
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
      playEndJourneyFeedback(safetyScore, distractionCount);
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
      setAiFeedback("Nessuna anomalia rilevata.");
      setRouteSuggestion(null);
      // LOGICA A DOPPIO STATUS
      speakText("Premi il pulsante per il monitoraggio in tempo reale");
      setUserStatus("Pronto per la partenza");
  }
  };
  
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
          <VideoMonitor 
            videoRef={videoRef} 
            canvasRef={canvasRef}
            isSleeping={isSleeping}
            variableX={variableX}
            sessionStatus={sessionStatus}
          />
          <AlertPanels 
              variableX={variableX} 
              isSleeping={isSleeping} 
              aiFeedback={aiFeedback} 
              routeSuggestion={routeSuggestion}
          ></AlertPanels>
        </div>
      )}

      {/* PANNELLO STATISTICHE FINALI (Appare solo a fine viaggio) */}
      {sessionStatus === "finished" && (
        <SummaryScreen
          tripDuration={tripDuration}
          safetyScore={safetyScore}
          distractionCount={distractionCount}
          formatTime={formatTime}
        />
      )}
    </div>
  );
}
