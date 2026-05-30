import { useEffect, useRef, useState } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { 
    calculate_ear, 
    playAlertBeep,
    LEFT_EYE, 
    RIGHT_EYE 
} from '../utils/helpers';

import { DMS_CONFIG } from '../utils/constant';

export const useMediaPipe = (videoRef, canvasRef, sessionStatus, onAlarm) => {
    const [isSleeping, setIsSleeping] = useState(false);
    const [variableX, setVariableX] = useState(0);

    const cameraRef = useRef(null);
    const closedStartTimeRef = useRef(null);
    const lastAlarmTimeRef = useRef(0);

    // MEDIAPIPE (EDGE COMPUTING) 
    useEffect(() => {
        // Se non siamo in viaggio o mancano i riferimenti, ferma tutto
        if (sessionStatus !== "active" || !videoRef.current || !canvasRef.current) {
            setVariableX(0);
            setIsSleeping(false);
            return;
        }

        const canvasCtx = canvasRef.current.getContext('2d'); 

        const faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
        });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true });  

        faceMesh.onResults((results) => {
            canvasCtx.clearRect(0, 0, 1280, 720);
            if (results.image) canvasCtx.drawImage(results.image, 0, 0, 1280, 720);  // Disegna la webcam e i landmark (se presenti)
            
            if (results.multiFaceLandmarks?.[0]) {    // [0] perché stiamo monitorando solo un volto (il conducente); '?.' per sicurezza non blocca il programma se non rileva volti
                const landmarks = results.multiFaceLandmarks[0];
                const ear = (calculate_ear(landmarks, LEFT_EYE) + calculate_ear(landmarks, RIGHT_EYE)) / 2;

                if (ear < DMS_CONFIG.EAR_THRESHOLD && sessionStatus === "active") {  
                    if (!closedStartTimeRef.current) {
                        closedStartTimeRef.current = performance.now();
                    }
                
                    const timeClosed = (performance.now() - closedStartTimeRef.current) / 1000;  // tempo da ms a s (secondi)
                    setVariableX(timeClosed.toFixed(2));
                    setIsSleeping(true);

                    // Allarme se il tempo di chiusura supera la soglia e non abbiamo suonato l'allarme negli ultimi 2 secondi (2000ms, per evitare spam)
                    if (timeClosed > DMS_CONFIG.X_SLEEP_THRESHOLD && (performance.now() - lastAlarmTimeRef.current > DMS_CONFIG.ALARM_DEBOUNCE)) {
                        playAlertBeep(); 
                        onAlarm(timeClosed.toFixed(2)); 
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

        // Avvio Webcam
        cameraRef.current = new Camera(videoRef.current, {
            onFrame: async () => await faceMesh.send({ image: videoRef.current }),
            width: 1280, height: 720
        });
        cameraRef.current.start();

        // Pulizia allo spegnimento
        return () => {
            if (cameraRef.current){
                cameraRef.current.stop();
            } 
            faceMesh.close();
        };
    }, [sessionStatus, onAlarm]); 

    return { isSleeping, variableX };
};
