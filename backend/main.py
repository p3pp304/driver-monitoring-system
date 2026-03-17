from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import cv2
import mediapipe as mp
import time

# Inizializzazione dell'applicazione FastAPI
app = FastAPI()

# --- INIZIALIZZAZIONE MEDIA PIPE ---
# Utilizziamo FaceMesh per estrarre 468 landmark facciali in tempo reale.
# refine_landmarks=True migliora la precisione attorno a occhi e labbra
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)

# Indici topologici degli occhi secondo la documentazione di MediaPipe
LEFT_EYE = [362, 385, 387, 263, 373, 390]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
EAR_THRESHOLD = 0.2  # Soglia empirica sotto la quale l'occhio è considerato chiuso

import math

def calculate_ear(landmarks, eye_indices):
    """
    Calcola l'Eye Aspect Ratio (EAR).
    Rapporto tra l'apertura verticale e orizzontale dell'occhio.
    Utilizza la distanza euclidea tra i tensori (landmark) spaziali.
    """
    # Funzione di supporto rapida per estrarre le coordinate x,y e calcolare la distanza
    def d(i, j):
        p1 = landmarks[eye_indices[i]]
        p2 = landmarks[eye_indices[j]]
        return math.dist((p1.x, p1.y), (p2.x, p2.y))

    # v1 e v2 sono le distanze verticali, h è la distanza orizzontale
    v1 = d(1, 5)
    v2 = d(2, 4)
    h  = d(0, 3)

    return (v1 + v2) / (2.0 * h)

# --- CONFIGURAZIONE LOGICA PROATTIVA ---
# Variabile x: Soglia critica di chiusura occhi (espressa in secondi)
# Se il tempo di chiusura occhi > X_SLEEP_THRESHOLD -> Intervento Proattivo
X_SLEEP_THRESHOLD = 1.5 

@app.get("/")
async def health_check():
    """
    Rotta diagnostica (Capitolo 5).
    Verifica che il container sia online e restituisce la soglia x corrente.
    """
    return {
        "status": "DMS Backend Online",
        "version": "1.0.0",
        "active_threshold_x": f"{X_SLEEP_THRESHOLD}s",
        "framework": "FastAPI (Asynchronous)"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Core del monitoraggio in tempo reale
    Gestisce la connessione persistente per lo streaming dei dati biometrici.
    """
    # Fase di Handshake: il server accetta la connessione permanente
    await websocket.accept()
    print("Connessione WebSocket stabilita. Monitoraggio conducente attivo.")
    
    try:
        # Loop infinito di monitoraggio (Stateful)
        while True:
            # Ricezione dei dati dal Frontend (es. coordinate occhi da MediaPipe)
            # await non blocca il server mentre aspetta i dati
            data = await websocket.receive_text()
            
            # --- LOGICA DI ELABORAZIONE ---
            # Qui integreremo l'analisi dei landmark e il calcolo della variabile x
            
            # Risposta immediata al frontend per confermare la bassa latenza
            await websocket.send_text(f"Dati ricevuti. Analisi in corso con soglia x: {X_SLEEP_THRESHOLD}s")
            
    except WebSocketDisconnect:
        # Gestione della disconnessione (fine del viaggio o chiusura app)
        print("Conducente disconnesso. Sessione di monitoraggio terminata.")
    except Exception as e:
        print(f"Errore critico durante lo streaming: {e}")