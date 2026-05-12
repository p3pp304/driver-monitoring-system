import React, { useState, useEffect, useRef } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// --- INIZIALIZZAZIONE MEDIA PIPE ---
// Utilizziamo FaceMesh per estrarre 468 landmark facciali in tempo reale.
// refine_landmarks=True migliora la precisione attorno a occhi e labbra

// Indici topologici degli occhi secondo la documentazione di MediaPipe
const LEFT_EYE = [362, 385, 387, 263, 373, 390]
const RIGHT_EYE = [33, 160, 158, 133, 153, 144]
const EAR_THRESHOLD = 0.2  //Soglia empirica sotto la quale l'occhio è considerato chiuso
const X_SLEEP_THRESHOLD = 0.8; // tempo minimo di chiusura occhi dopo il quale il conducente rileva come "dormiente"

function calculate_ear(landmarks, eye_indices) {
    /*Calcola l'Eye Aspect Ratio (EAR).
    Rapporto tra l'apertura verticale e orizzontale dell'occhio.
    Utilizza la distanza euclidea tra i tensori (landmark) spaziali.
    */    
    //Funzione di supporto rapida per estrarre le coordinate x,y e calcolare la distanza
    function d(i, j) {
        const p1 = landmarks[eye_indices[i]];
        const p2 = landmarks[eye_indices[j]];
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    //v1 e v2 sono le distanze verticali, h è la distanza orizzontale
    const v1 = d(1, 5);
    const v2 = d(2, 4);
    const h = d(0, 3);

    return (v1 + v2) / (2.0 * h)
}

// --- FUNZIONE TEXT-TO-SPEECH ---
const speakText = (text) => {
  // Verifica che il browser supporti la funzione
  if ('speechSynthesis' in window) {
    // 1. Ferma eventuali frasi precedenti ancora in riproduzione
    window.speechSynthesis.cancel();

    // 2. Prepara la frase da leggere
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 3. Configura la voce
    utterance.lang = 'it-IT'; // Imposta la pronuncia in italiano
    utterance.rate = 1.2;     // Velocità di lettura (da 0.1 a 10)
    utterance.pitch = 0;    // Tono della voce (da 0 a 2)
    
    // 4. Riproduci l'audio
    window.speechSynthesis.speak(utterance);
  } else {
    console.warn("Sintesi vocale non supportata in questo browser.");
  }
};

// Funzione per formattare i secondi in Minuti:Secondi
const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); //    Math.floor--> "arrotondare per difetto" tagliando via i decimali
    const s = (totalSeconds % 60).toString().padStart(2, '0');   // Modulo (%) --> calcolare il resto di una divisione. 125 diviso 60 fa 2, con il resto di 5.  .padStart(2, '0') --> "Se il numero ha meno di due cifre, mettici uno zero davanti". Quindi il 2 diventa "02"
    return `${m}m ${s}s`;
};

const playAlertBeep = () => {
    const audio = new Audio('/beep.mp3');
    audio.play();
};

// === COMPONENTE PRINCIPALE ===
export default function App() {
  // Stati UI
  const [sessionStatus, setSessionStatus] = useState("idle"); // "idle" | "active" | "finished" --> interrutore principale dell'app, controlla se siamo in viaggio o no
  const [tripDuration, setTripDuration] = useState(0);  // Tempo totale del viaggio in secondi (calcolato alla fine)
  const [distractionCount, setDistractionCount] = useState(0);  // Conta quante volte il conducente ha commesso errori (sonnolenza) durante il viaggio
  const [userStatus, setUserStatus] = useState("Pronto per la partenza");  // Stato utente semplificato per l'interfaccia (es. "Pronto", "In Viaggio", "Viaggio Terminato")
  const [techStatus, setTechStatus] = useState("Sistema React inizializzato. In attesa di input.");  // Stato tecnico dettagliato per debugging (non mostrato all'utente finale, ma utile durante lo sviluppo)
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

  // --- FUNZIONE INTERRUTTORE ---
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
      setTechStatus("Richiesta connessione V2N e avvio MediaPipe...");
      console.log("[SISTEMA] Avvio sessione di guida. Timestamp:", Date.now());
      
      speakText("Buon viaggio, guida con prudenza."); // Il sistema saluta il guidatore a voce

      tripStartTimeRef.current = Date.now(); // Fa partire il timer
      lastDistractionTime.current = Date.now(); 

      // --- ACCENSIONE GPS CONTINUO ---
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            currentLocationRef.current = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            // Log tecnico opzionale per vedere le coordinate che cambiano
            // console.log("[GPS] Aggiornamento:", currentLocationRef.current);
          },
          (error) => console.warn("[GPS] Errore o segnale perso:", error),
          { 
            enableHighAccuracy: true, // Sfrutta l'antenna GPS hardware se disponibile
            maximumAge: 10000,        // Accetta posizioni vecchie al massimo di 10 secondi
            timeout: 5000             // Tempo massimo per agganciare il satellite
          }
        );
      } else {
        console.warn("Geolocalizzazione non supportata dal browser.");
      }

    } else if (sessionStatus === "active") {
      // TERMINA IL VIAGGIO --> LOGICA A DOPPIO STATUS
      setSessionStatus("finished");
      if (safetyScore >= 90) {
        speakText(" Viaggio terminato. Ottimo lavoro, hai mantenuto un punteggio di sicurezza elevato durante la guida.");
      } else if (safetyScore >= 70) {
        speakText("Viaggio terminato. Buon lavoro, ma c'è margine di miglioramento. Cerca di evitare distrazioni per mantenere un punteggio più alto.");
      } else if (safetyScore >= 40) {
        speakText("Viaggio terminato. Attenzione, il tuo punteggio di sicurezza è basso. Cerca di mantenere la concentrazione alla guida per migliorare la tua sicurezza.");
      }else {
        speakText("Viaggio terminato. Il tuo punteggio di sicurezza è molto basso. Ti consigliamo in futuro di evitare distrazioni e di prestare maggiore attenzione alla guida per la tua sicurezza e quella degli altri.");
      }
      setUserStatus("Viaggio Terminato");
      setTechStatus("Disconnessione sensori e calcolo metriche in corso...");
      console.log("[SISTEMA] Viaggio terminato. Chiusura moduli.");

      // --- SPEGNIMENTO GPS ---
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }

      // Calcola i secondi totali trascorsi dall'inizio
      if (tripStartTimeRef.current) {
          const totalSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
          setTripDuration(totalSeconds);
      }
    }else if(sessionStatus === "finished") {
      // RESETTA PER UN NUOVO VIAGGIO
      setSessionStatus("idle");
      setSafetyScore(100);
      // LOGICA A DOPPIO STATUS
      speakText("Premi il pulsante per il monitoraggio in tempo reale");
      setUserStatus("Pronto per una nuova partenza");
      setTechStatus("Sistema resettato. Idle state.");
      console.log("[SISTEMA] Reset dell'interfaccia completato.");

    }
  };

  // --- 1. WEBSOCKET ---
  useEffect(() => {   // Stabilisce la connessione WebSocket al backend FastAPI; viene eseguito una sola volta all'avvio di App
    
    if (sessionStatus !== "active") return;  // BLOCCO: Ferma tutto se il viaggio non è "active" (ovvero se è "idle" o "finished"). In questo modo, se l'utente preme il pulsante per iniziare il viaggio, allora si stabilisce la connessione WebSocket e si avviano i sensori. Se invece preme per terminare, la connessione si chiude e i sensori si fermano (grazie alla pulizia del useEffect).

    wsRef.current = new WebSocket('ws://localhost:8000/ws');  
    wsRef.current.onopen = () => {
      setTechStatus("Connessione WebSocket [ONLINE]");
      console.log("[NETWORK] Handshake WebSocket completato sulla porta 8000."); 
    };
    wsRef.current.onclose = () => {
      setTechStatus("Connessione WebSocket [OFFLINE]");
      console.log("[NETWORK] Canale WebSocket chiuso.");
    }; 
    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === "PROACTIVE_ASSISTANCE") {
        setAiFeedback(response.voice_text);  // Aggiorna il feedback dell'assistente IA con il testo ricevuto dal server
        speakText(response.voice_text);
        setRouteSuggestion(response.maps_route); // Aggiorna la proposta di deviazione con i dati ricevuti dal server (se presenti)
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
            // Invia dati al server
            wsRef.current?.send(JSON.stringify({
              event: "DROWSINESS_DETECTED",
              variable_x: timeClosed.toFixed(2),
              location: currentLocationRef.current // Invia anche le coordinate GPS attuali al server per un possibile intervento proattivo
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
        <h1 className="p-1 text-center text-3xl font-bold text-blue-400">
          Driver Monitoring System
        </h1>

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
              {routeSuggestion ? `${routeSuggestion.name}` : "Nessuna deviazione"}
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
