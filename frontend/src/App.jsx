import React, { useState, useRef, useEffect } from 'react';

// Import Componenti
import Navbar from './components/NavBar';
import VideoMonitor from './components/VideoMonitor';
import AlertPanels from './components/AlertPanels';
import SummaryScreen from './components/SummaryScreen';

// Importa gli Hook e le funzioni utils, servizi esterni
import { useDmsWebSocket } from './hooks/useDmsWebSocket';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useGeolocation } from './hooks/useGeolocation';
import { speakText, formatTime} from './utils/helpers';
import { playEndJourneyFeedback } from './services/audioFeedback';

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

  // ---3. HOOKS PERSONALIZZATI---

      // 1. WebSocket per comunicazione con il server FastAPI
  const { techStatus, sendWsMessage } = useDmsWebSocket(sessionStatus, (response) => {
      // Cosa fare quando riceviamo un messaggio di assistenza proattiva dal server
      setAiFeedback(response.voice_text);
      setRouteSuggestion(response.maps_route);
      setSafetyScore(prev => Math.max(0, prev - response.penalty)); // Penalità variabile per ogni distrazione rilevata
      setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni
      speakText(response.voice_text + " La zona di sosta più vicina è: " + response.maps_route.name + "a " + response.maps_route.distance_kilometers + " chilometri"); // Il sistema legge ad alta voce il feedback ricevuto + eventuale suggerimento di percorso
  }, 
  (bonusResponse) => {
      setSafetyScore(prev => Math.min(100, prev + bonusResponse.points));
      speakText("Ottima guida! Hai guadagnato " + bonusResponse.points + " punti! "); // Il sistema legge ad alta voce il bonus ricevuto
  });

       // 2. Geolocalizzazione per tracciare la posizione del veicolo durante il viaggio
  const { currentLocationRef } = useGeolocation(sessionStatus);

      // 3. MediaPipe per il monitoraggio in tempo reale del conducente
  const { isSleeping, variableX } = useMediaPipe(videoRef, canvasRef, sessionStatus, (timeClosed) => {
      // Invia un messaggio al server per notificare l'allarme di sonnolenza
    sendWsMessage({ 
        event: "DROWSINESS_DETECTED", 
        variable_x: timeClosed,
        location: currentLocationRef.current, // Invia anche la posizione attuale del conducente
      }); 
  });



  // --- 3. LOGICA DI BENVENUTO INIZIALE ---
  useEffect(() => {
    if (sessionStatus === "started") {
      // Il sistema parla solo una volta all'avvio
      speakText("Benvenuto, io sono il tuo assistente virtuale di guida. Premi il pulsante Inizia Viaggio per attivare il monitoraggio in tempo reale.");
      // Passa immediatamente allo stato di attesa
      setSessionStatus("idle");
    }
  }, [sessionStatus]);

  //FUNZIONI DI SUPPORTO(a toggleJourney)

  const toggleJourney = () => {
    if (sessionStatus === "idle") {
        // INIZIA IL VIAGGIO
        setSafetyScore(100);
        setDistractionCount(0);
        setTripDuration(0);
        setAiFeedback("Nessuna anomalia rilevata.");
        setRouteSuggestion(null);
        setSessionStatus("active");
        setUserStatus("In Viaggio");
        speakText("Buon viaggio, guida con prudenza."); // Il sistema saluta il guidatore a voce

        tripStartTimeRef.current = Date.now(); // Fa partire il timer

  } else if (sessionStatus === "active") {
      // TERMINA IL VIAGGIO --> LOGICA A DOPPIO STATUS
      setSessionStatus("finished");
      playEndJourneyFeedback(safetyScore, distractionCount);
      setUserStatus("Viaggio Terminato");
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
