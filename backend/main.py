import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json
from datetime import datetime
from services.gemini_service import genera_assistenza_vocale
from services.maps_service import get_nearest_safe_zone
from services.scoring_service import calculate_smart_penalty

# Inizializzazione dell'applicazione FastAPI
app = FastAPI()                                                        

@app.get("/")   # Verifica che il container sia online
async def health_check():
    return {
        "status": "DMS Backend Online",
        "version": "2.0.0",
        "architecture": "Edge-Computing (V2N)",
        "framework": "FastAPI (Asynchronous)"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Core del sistema proattivo. Riceve le misurazioni dal frontend (React)
    e innesca i moduli di assistenza (Gemini & Maps).
    """
    await websocket.accept()  # Fase di Handshake: il server accetta la connessione permanente
    print("[NETWORK] Connessione WebSocket stabilita. In attesa di telemetria...")

    last_event_time = datetime.now()
    last_bonus_time= last_event_time
    last_ai_response_time = None # Variabile di stato per il cooldown dell'IA
    
    # --- TASK IN BACKGROUND (gestore del Bonus) ---
    async def bonus_manager():
        nonlocal last_bonus_time
        try:
            while True:
                await asyncio.sleep(60) # Controlla ogni 60 secondi
                now = datetime.now()
                
                secondi_trascorsi = (now - last_bonus_time).total_seconds()
                
                if secondi_trascorsi >= 600: # 600 secondi = 10 minuti di guida sicura
                    messaggio_bonus = {
                        "type": "SAFETY_BONUS",
                        "points": 5
                    }
                    await websocket.send_text(json.dumps(messaggio_bonus))
                    last_bonus_time = now   # Resetta il timer dopo aver dato il bonus
                    print("[BONUS] Bonus sicurezza inviato al veicolo dal server.")
        except asyncio.CancelledError:
            pass

    # Avviamo il worker in parallelo alla connessione
    bonus_task = asyncio.create_task(bonus_manager())

    try:
        while True:
            data = await websocket.receive_text()  # Ricezione misure dal frontend

            try:
                payload = json.loads(data)
            except json.JSONDecodeError:
                print(f"[ERROR] Dati ricevuti non validi: {data}")
                continue  # Salta questo ciclo
            
            if payload.get("event") == "DROWSINESS_DETECTED":   
                var_x = payload.get("variable_x")
                location = payload.get("location")
                print(f"[NETWORK] ALLARME RICEVUTO! Il conducente ha chiuso gli occhi per {var_x} secondi | Posizione: {location['lat']}, {location['lng']}")

                last_bonus_time=datetime.now()
                
                # LOGICA DI INTERVENTO PROATTIVO 
                ai_task = genera_assistenza_vocale(var_x, last_ai_response_time) 
                maps_task = get_nearest_safe_zone(location["lat"], location["lng"]) 
                ai_result, safe_zone = await asyncio.gather(ai_task, maps_task)    # asyncio.gather --> permette di eseguire in parallelo i task, vengono dimezzati i tempi

                ai_response, last_ai_response_time = ai_result 
                penalty_points,last_event_time = calculate_smart_penalty(var_x, last_event_time)

                # PACCHETTO DI RISPOSTA --> costruzione+invio (serve-->client)
                risoluzione = {
                    "type": "PROACTIVE_ASSISTANCE",
                    "voice_text": ai_response,
                    "maps_route": safe_zone,
                    "penalty": penalty_points
                }
                
                await websocket.send_text(json.dumps(risoluzione))
                print("[NETWORK] Pacchetto di assistenza proattiva inviato al veicolo con successo.")

    except WebSocketDisconnect:
        print("[NETWORK] Veicolo disconnesso. Sessione terminata.")
    except Exception as e:
        print(f"[ERROR] Errore critico nel server: {e}")
    finally:
        bonus_task.cancel() # Chiudiamo il worker quando il veicolo si disconette
    
