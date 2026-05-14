import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { 
    calculate_ear, 
    playAlertBeep,
    LEFT_EYE, 
    RIGHT_EYE, 
    EAR_THRESHOLD, 
    X_SLEEP_THRESHOLD 
} from '../utils/helpers';

export const useMediaPipe = (videoRef, canvasRef, sessionStatus, onAlarm) => {
    const [isSleeping, setIsSleeping] = useState(false);
    const [variableX, setVariableX] = useState(0);

    const cameraRef = useRef(null);
    const closedStartTimeRef = useRef(null);
    const lastAlarmTimeRef = useRef(0);

    // MEDIAPIPE (EDGE COMPUTING) ---
    useEffect(() => {
        // Se non siamo in viaggio o mancano i riferimenti HTML, ferma tutto
        if (sessionStatus !== "active" || !videoRef.current || !canvasRef.current) {
            setVariableX(0);
            setIsSleeping(false);
            return;
        }

         // Ottieni il contesto 2D del canvas per poter disegnare sopra la webcam
        const canvasCtx = canvasRef.current.getContext('2d'); 

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
                        playAlertBeep(); // Suona un beep di allarme
                        onAlarm(timeClosed.toFixed(2)); // Passa il tempo di chiusura alla callback in App.jsx per aggiornare lo stato principale e inviare dati al server
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
            faceMesh.close();
        };
    }, [sessionStatus, videoRef, canvasRef]); 

    // Ritorna gli stati visivi necessari per la UI
    return { isSleeping, variableX };
};
