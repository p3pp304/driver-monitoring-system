import React, { useState, useEffect } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';

// --- INIZIALIZZAZIONE MEDIA PIPE ---
// Utilizziamo FaceMesh per estrarre 468 landmark facciali in tempo reale.
// refine_landmarks=True migliora la precisione attorno a occhi e labbra

// Indici topologici degli occhi secondo la documentazione di MediaPipe
const LEFT_EYE = [362, 385, 387, 263, 373, 390]
const RIGHT_EYE = [33, 160, 158, 133, 153, 144]
const EAR_THRESHOLD = 0.2  //Soglia empirica sotto la quale l'occhio è considerato chiuso
const X_SLEEP_THRESHOLD = 1.5; // tempo minimo di chiusura occhi dopo il quale il conducente rileva come "dormiente"

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
    const audio = new Audio('/beep.mp3');
    audio.play();
};

function App() {
  const [status, setStatus] = useState("Connessione in corso...");
  const [variableX, setVariableX] = useState(0);

  useEffect(() => {  // Effettua la connessione WebSocket quando il componente viene montato
    const socket = new WebSocket('ws://localhost:8000/ws');

    socket.onopen = () => setStatus("Sistema Attivo");
    socket.onmessage = (event) => {
      console.log("Dati DMS:", event.data);
      // Qui aggiorneremo il valore della variabile x
    };
    socket.onclose = () => setStatus("Offline");

    return () => socket.close(); // Chiude la connessione WebSocket quando il componente viene smontato
  }, []);  // []--> Effettua la connessione WebSocket una sola volta all'avvio del componente

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      
      {/* Titolo */}
      <h1 className="text-4xl font-bold text-blue-400 mb-8 tracking-wide">
        DMS - Driver Monitoring System
      </h1>
      
      {/* Contenitore delle Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-10">
        
        {/* Card 1: Stato */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase tracking-wider mb-2">
            Stato Sensore
          </span>
          <span className={`text-2xl font-semibold ${status === "Sistema Attivo" ? "text-green-400" : "text-yellow-400"}`}>
            {status}
          </span>
        </div>

        {/* Card 2: La tua Variabile x */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase tracking-wider mb-2">
            Variabile x (Chiusura Occhi)
          </span>
          <div className="text-4xl font-mono font-bold text-white">
            {variableX} <span className="text-lg text-slate-500">sec</span>
          </div>
        </div>
        
      </div>

      {/* Riquadro Video */}
      <div className="w-full max-w-3xl aspect-video bg-black rounded-3xl border-4 border-slate-800 flex items-center justify-center">
        <p className="text-slate-500 italic">
          Streaming Webcam (Prossima Fase)
        </p>
      </div>
      
    </div>
  );
}

export default App;