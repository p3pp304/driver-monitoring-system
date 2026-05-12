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
  const [status, setStatus] = useState("Inizializzazione...");  
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

// --- FUNZIONE INTERRUTTORE ---
  const toggleJourney = () => {
    if (sessionStatus !== "active") {
      // INIZIA IL VIAGGIO
      setSafetyScore(100);
      setDistractionCount(0);
      setVariableX(0);
      setTripDuration(0);
      setAiFeedback("Nessuna anomalia rilevata.");
      setRouteSuggestion(null);
      setSessionStatus("active");
      setStatus("Sensori e V2N Attivi");
      
      tripStartTimeRef.current = Date.now(); // Fa partire il timer
      lastDistractionTime.current = Date.now(); 
    } else {
      // TERMINA IL VIAGGIO
      setSessionStatus("finished");
      setStatus("Viaggio Terminato");
      
      // Calcola i secondi totali trascorsi dall'inizio
      if (tripStartTimeRef.current) {
          const totalSeconds = Math.floor((Date.now() - tripStartTimeRef.current) / 1000);
          setTripDuration(totalSeconds);
      }
    }
  };

  // --- 1. WEBSOCKET ---
  useEffect(() => {   // Stabilisce la connessione WebSocket al backend FastAPI; viene eseguito una sola volta all'avvio di App
    
    if (sessionStatus !== "active") return;  // BLOCCO: Ferma tutto se il viaggio non è "active" (ovvero se è "idle" o "finished"). In questo modo, se l'utente preme il pulsante per iniziare il viaggio, allora si stabilisce la connessione WebSocket e si avviano i sensori. Se invece preme per terminare, la connessione si chiude e i sensori si fermano (grazie alla pulizia del useEffect).

    wsRef.current = new WebSocket('ws://localhost:8000/ws');  
    wsRef.current.onopen = () => setStatus("Connesso al Server");  // Quando la connessione è stabilita, aggiorna lo stato per riflettere che siamo connessi
    wsRef.current.onclose = () => setStatus("Disconnesso"); // Se la connessione si chiude (ad esempio, quando termina il viaggio), aggiorna lo stato per riflettere che siamo disconnessi
    
    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === "PROACTIVE_ASSISTANCE") {
        setAiFeedback(response.voice_text);  // Aggiorna il feedback dell'assistente IA con il testo ricevuto dal server
        setRouteSuggestion(response.maps_route); // Aggiorna la proposta di deviazione con i dati ricevuti dal server (se presenti)
        setSafetyScore(prev => Math.max(0, prev - response.penalty)); // Applica la penalità al punteggio di sicurezza, assicurandosi che non scenda sotto 0
        setDistractionCount(prev => prev + 1); // Incrementa il contatore di distrazioni (errori) 
        lastDistractionTime.current = Date.now();  // Aggiorna l'orario dell'ultimo errore
      }
    };

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

        if (ear < EAR_THRESHOLD) {
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
              variable_x: timeClosed.toFixed(2)
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
      <header className=" mb-5 ">
        <div className='flex justify-between items-center'>
          <h1 className="text-3xl font-bold text-blue-400">Driver Monitoring System</h1>
          <h2 className={`text-3xl font-bold ${safetyScore >= 90 ? "text-green-400" : (safetyScore >= 70 ? "text-lime-500" : (safetyScore >= 40 ? "text-orange-500" : "text-red-600"))}`}>Score: {safetyScore}</h2>
        </div>
        <p className="text-gray-400">{status}</p>
      </header>

      {/* CONTENITORE PRINCIPALE (Webcam a sinistra, Dati a destra) */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        
        {/* WEBCAM E ALLARME */}
        <div className="relative w-full md:w-2/3 bg-gray-900 aspect-video shrink-0">
          <video ref={videoRef} className="hidden" playsInline></video>
          <canvas 
            ref={canvasRef} 
            width="1280" 
            height="720"
            className="w-full h-full transform -scale-x-100 object-cover" 
          ></canvas>

          {/* OVERLAY ALLARME */}
          {isSleeping && variableX > X_SLEEP_THRESHOLD && (
            <div className="absolute inset-0 bg-red-600 flex items-center justify-center animate-pulse">
              <span className="text-white text-7xl font-black ">ALLARME!</span>
            </div>
          )}
        </div>

        {/* PANNELLI DATI */}
        <div className="w-full md:w-1/3 flex flex-col gap-4 text-lg">
          
          {/* 1. Variabile X */}
          <div className={`p-4 ${isSleeping && variableX > 0 ? 'bg-red-900' : 'bg-gray-800'}`}>
            <span className="text-gray-400 text-sm">Variabile x (Chiusura)</span>
            <div className="text-4xl font-bold">{variableX} s</div>
          </div>

          {/* 2. Assistente IA */}
          <div className="p-4 bg-gray-800">
            <span className="text-gray-400 text-sm">Assistente IA</span>
            <p className="italic mt-1 break-words">"{aiFeedback}"</p>
          </div>

          {/* 3. Mappe */}
          <div className="p-4 bg-gray-800">
            <span className="text-gray-400 text-sm">Navigazione</span>
            <p className="font-bold mt-1 break-words">
              {routeSuggestion ? `${routeSuggestion.name} (+${routeSuggestion.distance} min)` : "Nessuna deviazione"}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
