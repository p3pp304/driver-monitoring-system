import { DMS_CONFIG } from "./constant";

// Indici topologici degli occhi secondo la documentazione di MediaPipe
export const LEFT_EYE = [362, 385, 387, 263, 373, 390]
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144]


//Calcolo l'Eye Aspect Ratio (EAR) --> Rapporto tra l'apertura verticale e orizzontale dell'occhio 
export function calculate_ear(landmarks, eye_indices) {
    
    function d(i, j) {  // funzione per calcolare distanza fra i punti
        const p1 = landmarks[eye_indices[i]];
        const p2 = landmarks[eye_indices[j]];
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    //v1 e v2 --> distanze verticali, h --> la distanza orizzontale
    const v1 = d(1, 5);
    const v2 = d(2, 4);
    const h = d(0, 3);

    return (v1 + v2) / (2.0 * h)
}

// FUNZIONE TEXT-TO-SPEECH 
export const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'it-IT';
    utterance.rate = 1.25;  // velocità voce
    utterance.pitch = 0; //tonalità voce

    window.speechSynthesis.speak(utterance);
}



// Funzione per formattare i secondi in Minuti:Secondi
export const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); 
    const s = (totalSeconds % 60).toString().padStart(2, '0');  // .padStart(2, '0') --> Se il numero ha meno di due cifre, ci mette uno zero davanti". Quindi il 2 diventa "02"
    return `${m}m ${s}s`;
};

export const playAlertBeep = () => {
    const audio = new Audio('/beep.mp3');
    audio.play();
};