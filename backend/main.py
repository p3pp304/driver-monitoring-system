from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json
from datetime import datetime

# Inizializzazione dell'applicazione FastAPI
app = FastAPI()                                                        

@app.get("/")
async def health_check():
    """
    Verifica che il container sia online e restituisce la soglia x corrente.
    """
    return {
        "status": "DMS Backend Online",
        "version": "2.0.0",
        "architecture": "Edge-Computing (V2N)",
        "framework": "FastAPI (Asynchronous)"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Core del sistema proattivo. Riceve la telemetria dal nodo frontend (React)
    e innesca i moduli di assistenza (Voice & Maps).
    """
    # Fase di Handshake: il server accetta la connessione permanente
    await websocket.accept()
    print("✅ Connessione WebSocket stabilita. In attesa di telemetria...")
    
    try:
        # Loop infinito: il server "ascolta" in silenzio senza consumare CPU
        while True:
            # 1. Ricezione dell'allarme dal Frontend
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # 2. Controllo dell'evento ricevuto
            if payload.get("event") == "DROWSINESS_DETECTED":
                var_x = payload.get("variable_x")
                print(f"🚨 ALLARME RICEVUTO! Il conducente ha chiuso gli occhi per {var_x} secondi.")
                
                # --- PILASTRO 1 & 2: LOGICA DI INTERVENTO PROATTIVO ---
                # (Qui in futuro integreremo le vere API di Gemini e Google Maps)
                # Per ora simuliamo la loro risposta intelligente:
                
                ai_response = f"Attenzione, ho rilevato un colpo di sonno di {var_x} secondi. Ti consiglio vivamente di fermarti. Ho impostato il navigatore per l'area di sosta più vicina."
                
                maps_suggestion = {
                    "name": "Area di Sosta 'La Macchia' (A14)",
                    "distance": "3", # minuti di deviazione
                    "lat": 41.1234,
                    "lng": 16.5678
                }
                
                penalty_points = 5 # Punti da sottrarre al Safety Score
                
                # 3. Costruzione del pacchetto di "Risoluzione Attiva"
                risoluzione = {
                    "type": "PROACTIVE_ASSISTANCE",
                    "voice_text": ai_response,
                    "maps_route": maps_suggestion,
                    "penalty": penalty_points
                }
                
                # 4. Invio delle istruzioni al veicolo (Frontend)
                await websocket.send_text(json.dumps(risoluzione))
                print("📡 Assistenza Proattiva inviata al veicolo con successo.")

    except WebSocketDisconnect:
        print("❌ Veicolo disconnesso. Sessione V2N terminata.")
    except Exception as e:
        print(f"⚠️ Errore critico nel server: {e}")
    
