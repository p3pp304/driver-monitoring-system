from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import cv2
import mediapipe as mp
import time

# Inizializzazione dell'applicazione FastAPI
app = FastAPI()



@app.get("/")
async def health_check():
    """
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
    Core del monitoraggio in tempo reale con MediaPipe
    """
    # Fase di Handshake: il server accetta la connessione permanente
    await websocket.accept()
    print("Connessione WebSocket stabilita. Monitoraggio conducente attivo.")
    
    try:
        # Sostituisci questo URL con l'indirizzo esatto che vedi sul telefono
        URL_TELEFONO = "http://192.168.1.201:8080"  
        cap = cv2.VideoCapture(URL_TELEFONO)
        # Loop infinito di monitoraggio (Stateful)
        while True:
            while cap.isOpened():
                success, frame = cap.read()
                if not success: 
                    print("Impossibile leggere dalla webcam")
                    break

                # --- LOGICA DI ELABORAZIONE MEDIAPIPE ---
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)  # BGR -> RGB per MediaPipe
                results = face_mesh.process(rgb_frame)

                if results.multi_face_landmarks: # Se non viene rilevato un volto, allora non facciamo None
                    mesh = results.multi_face_landmarks[0].landmark # 0 perché consideriamo solo il primo volto rilevato (conducente)
                    ear = (calculate_ear(mesh, LEFT_EYE) + calculate_ear(mesh, RIGHT_EYE)) / 2.0
                    
                    # STAMPA NEL TERMINALE E INVIO DATI AL FRONTEND
                    if ear < 0.2:
                        print(f"[{round(ear, 2)}] ⚠️ OCCHI CHIUSI!")
                        # Invia "1" al frontend per indicare pericolo
                        await websocket.send_text("1") 
                    else:
                        print(f"[{round(ear, 2)}] 👀 OCCHI APERTI")
                        # Invia "0" al frontend per indicare sicurezza
                        await websocket.send_text("0")
            
    except WebSocketDisconnect:

            print("Conducente disconnesso. Sessione di monitoraggio terminata.")
    except Exception as e:
        print(f"Errore critico durante lo streaming: {e}")
    finally:
        # Rilascia la webcam quando si chiude la connessione (fondamentale per non bloccare la telecamera!)
        cap.release()