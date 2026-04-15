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

const playAlertBeep = () => {
    const audio = new Audio('/public/beep.mp3');
    audio.play();
};

// === COMPONENTE PRINCIPALE ===
export default function App() {
  // Stati UI
  const [status, setStatus] = useState("Inizializzazione...");
  const [variableX, setVariableX] = useState(0);
  const [isSleeping, setIsSleeping] = useState(false);
  
  // Stati Proattivi
  const [safetyScore, setSafetyScore] = useState(100);
  const [aiFeedback, setAiFeedback] = useState("Nessuna anomalia rilevata.");
  const [routeSuggestion, setRouteSuggestion] = useState(null);

  // Riferimenti
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const closedStartTimeRef = useRef(null);
  const lastAlarmTimeRef = useRef(0);

  // --- 1. WEBSOCKET ---
  useEffect(() => {   // Stabilisce la connessione WebSocket al backend FastAPI; viene eseguito una sola volta all'avvio di App
    wsRef.current = new WebSocket('ws://localhost:8000/ws');
    wsRef.current.onopen = () => setStatus("Connesso al Server");
    wsRef.current.onclose = () => setStatus("Disconnesso");
    
    wsRef.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      if (response.type === "PROACTIVE_ASSISTANCE") {
        setAiFeedback(response.voice_text);
        setRouteSuggestion(response.maps_route);
        setSafetyScore(prev => Math.max(0, prev - response.penalty));
      }
    };
    return () => wsRef.current.close();
  }, []);

  // --- 2. MEDIAPIPE (EDGE COMPUTING) ---
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvasCtx = canvasRef.current.getContext('2d');

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });

    faceMesh.onResults((results) => {
      // Disegna la webcam
      canvasCtx.clearRect(0, 0, 1280, 720);
      canvasCtx.drawImage(results.image, 0, 0, 1280, 720);
      
      if (results.multiFaceLandmarks?.[0]) {
        const landmarks = results.multiFaceLandmarks[0];
        const ear = (calculate_ear(landmarks, LEFT_EYE) + calculate_ear(landmarks, RIGHT_EYE)) / 2;

        if (ear < EAR_THRESHOLD) {
          if (!closedStartTimeRef.current) closedStartTimeRef.current = performance.now();
          
          const timeClosed = (performance.now() - closedStartTimeRef.current) / 1000;
          setVariableX(timeClosed.toFixed(2));
          setIsSleeping(true);

          // Allarme
          if (timeClosed > X_SLEEP_THRESHOLD && (performance.now() - lastAlarmTimeRef.current > 2000)) {
            
            // Suona il file MP3 in modo semplicissimo!
            new Audio('/public/beep.mp3').play(); 
            
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
    const camera = new Camera(videoRef.current, {
      onFrame: async () => await faceMesh.send({ image: videoRef.current }),
      width: 1280, height: 720
    });
    camera.start();
  }, []);

  
// --- 3. INTERFACCIA MINIMAL ---
  return (
    <div className="min-h-screen bg-black text-white p-4">
      
      {/* HEADER */}
      <header className="flex justify-between items-center mb-4 max-w-6xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">DMS Proattivo</h1>
          <p className="text-gray-400">{status}</p>
        </div>
        <h2 className="text-3xl font-bold text-green-400">Score: {safetyScore}</h2>
      </header>

      {/* CONTENITORE PRINCIPALE (Webcam a sinistra, Dati a destra) */}
      <div className="flex flex-col md:flex-row gap-4">
        
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
              <span className="text-white text-6xl font-black ">ALLARME!</span>
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