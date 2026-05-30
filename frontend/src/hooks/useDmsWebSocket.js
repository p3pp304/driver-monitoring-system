 import { useEffect, useRef, useState } from 'react';
 
 // --- 1. WEBSOCKET ---

 export const useDmsWebSocket = (sessionStatus, onDistraction, onBonus) => {
    const wsRef = useRef(null);
    const [techStatus, setTechStatus] = useState("Sistema di monitoraggio in attesa");  // Stato tecnico dettagliato per debugging (non mostrato all'utente finale, ma utile durante lo sviluppo)

    useEffect(() => {
        // Se non siamo in viaggio, non apriamo la connessione
        if (sessionStatus !== "active") {
            setTechStatus("Sistema di monitoraggio in attesa");
            return;
        }

        wsRef.current = new WebSocket('ws://localhost:8000/ws');
        
        wsRef.current.onopen = () => {
            setTechStatus("Connesso al server");
            console.log("[NETWORK] Handshake WebSocket completato sulla porta 8000."); 
        };

        wsRef.current.onerror = (error) => {
            console.error("[ERROR] Anomalia hardware o di rete rilevata sul socket:", error);
        };
        
        wsRef.current.onmessage = (event) => {
            try{
                const response = JSON.parse(event.data);
                if (response.type === "PROACTIVE_ASSISTANCE") {
                    onDistraction(response);
                    console.log("[ASSISTANCE] Pacchetto di assistenza proattiva ricevuto:", response);
                }
                else if (response.type === "SAFETY_BONUS") {
                    onBonus(response);
                    console.log("[BONUS] Bonus di sicurezza ricevuto:", response);
                }
            }catch (error){
                console.error("[ERROR] Errore nel parsing del payload WebSocket in ingresso:", error);
            }
        };

        wsRef.current.onclose = () => {
            setTechStatus("Disconnesso dal server");
            console.log("[NETWORK] Canale WebSocket chiuso.");
        }; 

        return () => { 
            if (wsRef.current){
                 wsRef.current.close(); 
            } 
        };
        
    }, [sessionStatus]);

    const sendWsMessage = (message) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        } else {
            console.warn("[WARNING] Impossibile inviare le misure: canale WebSocket non attivo.");
        }
    };

    return { techStatus, sendWsMessage };
};