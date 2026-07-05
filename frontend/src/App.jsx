import { useEffect, useRef, useState } from 'react';

// Import Componenti
import AlertPanels from './components/AlertPanels';
import Navbar from './components/NavBar';
import SummaryScreen from './components/SummaryScreen';
import VideoMonitor from './components/VideoMonitor';

// Import Hooks, funzioni utils e servizi esterni
import { useDmsWebSocket } from './hooks/useDmsWebSocket';
import { useGeolocation } from './hooks/useGeolocation';
import { useMediaPipe } from './hooks/useMediaPipe';
import { playEndJourneyFeedback } from './services/audioFeedback';
import { SESSION_STATUS } from './utils/constant';
import { formatTime, speakText } from './utils/helpers';

//  COMPONENTE PRINCIPALE APP()

export default function App() {
  // STATI
  const [sessionStatus, setSessionStatus] = useState(SESSION_STATUS.STARTED); // "started" | "idle" | "active" | "finished" --> interrutore principale dell'app, controlla se siamo in viaggio o no
  const [tripDuration, setTripDuration] = useState(0);  // Tempo totale del viaggio in secondi (calcolato alla fine)
  const [distractionCount, setDistractionCount] = useState(0);  // Conta quante volte il conducente ha commesso errori (sonnolenza) durante il viaggio
  const [userStatus, setUserStatus] = useState("Pronto per la partenza");  // Stato utente semplificato per l'interfaccia (es. "Pronto", "In Viaggio", "Viaggio Terminato")
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiFeedback, setAiFeedback] = useState("Nessuna anomalia rilevata.");
  const [routeSuggestion, setRouteSuggestion] = useState(null); 

  // RIFERIMENTI
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tripStartTimeRef = useRef(null); // <-- Riferimento per l'inizio del viaggio

  // HOOKS

      // 1. WebSocket
  const { techStatus, sendWsMessage } = useDmsWebSocket(sessionStatus, (response) => { // OnDistraction
      setAiFeedback(response.voice_text);
      setRouteSuggestion(response.maps_route);
      setSafetyScore(prev => Math.max(0, prev - response.penalty)); 
      setDistractionCount(prev => prev + 1); 
      speakText(response.voice_text + " La zona di sosta più vicina è: " + response.maps_route.name + "a " + response.maps_route.distance_kilometers + " chilometri"); 
  }, 
  (bonusResponse) => { //OnBonus
      setSafetyScore(prev => Math.min(100, prev + bonusResponse.points));
      speakText("Ottima guida! Hai guadagnato " + bonusResponse.points + " punti! ");
  });

       // 2. Geolocalizzazione 
  const { currentLocationRef } = useGeolocation(sessionStatus);

      // 3. MediaPipe 
  const { isSleeping, variableX } = useMediaPipe(videoRef, canvasRef, sessionStatus, (timeClosed) => {
    sendWsMessage({  // onAlarm--> Invia un messaggio al server per avvisare della distrazione
        event: "DROWSINESS_DETECTED", 
        variable_x: timeClosed,
        location: currentLocationRef.current, // posizione attuale conducente
      }); 
  });


  // --- 3. LOGICA DI BENVENUTO INIZIALE ---
  useEffect(() => {
    if (sessionStatus === SESSION_STATUS.STARTED) {
      // Il sistema parla solo una volta all'avvio
      speakText("Benvenuto, io sono il tuo assistente virtuale di guida. Premi il pulsante Inizia Viaggio per attivare il monitoraggio in tempo reale.");
      // Passa immediatamente allo stato di attesa
      setSessionStatus(SESSION_STATUS.IDLE);
    }
  }, [sessionStatus]);


  const toggleJourney = () => {
    if (sessionStatus === SESSION_STATUS.IDLE) {
        // INIZIA IL VIAGGIO
        setSafetyScore(100);
        setDistractionCount(0);
        setTripDuration(0);
        setAiFeedback("Nessuna anomalia rilevata.");
        setRouteSuggestion(null);
        setSessionStatus(SESSION_STATUS.ACTIVE);
        setUserStatus("In Viaggio");
        speakText("Buon viaggio, guida con prudenza.");
        tripStartTimeRef.current = Date.now();  // Fa partire il timer

  } else if (sessionStatus === SESSION_STATUS.ACTIVE) {
      // TERMINA IL VIAGGIO 
      setSessionStatus(SESSION_STATUS.FINISHED);
      playEndJourneyFeedback(safetyScore, distractionCount);
      setUserStatus("Viaggio Terminato");
      
      if (tripStartTimeRef.current) {
          const totalSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
          setTripDuration(totalSeconds);
      }
  }else if(sessionStatus === SESSION_STATUS.FINISHED) {
      // RESETTA PER UN NUOVO VIAGGIO
      setSessionStatus(SESSION_STATUS.IDLE);
      setSafetyScore(100);
      setAiFeedback("Nessuna anomalia rilevata.");
      setRouteSuggestion(null);
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

      {/* DASHBOARD */}
      {sessionStatus !== SESSION_STATUS.FINISHED && (
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

      {/* PANNELLO STATISTICHE FINALI*/}
      {sessionStatus === SESSION_STATUS.FINISHED && (
        <SummaryScreen
          tripDuration={tripDuration}
          safetyScore={safetyScore}
          distractionCount={distractionCount}
          formatTime={formatTime}
        />
      )}
    </div>
  );
};
