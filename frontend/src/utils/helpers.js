

// Indici topologici degli occhi secondo la documentazione di MediaPipe
export const LEFT_EYE = [362, 385, 387, 263, 373, 390]
export const RIGHT_EYE = [33, 160, 158, 133, 153, 144]
export const EAR_THRESHOLD = 0.2  //Soglia empirica sotto la quale l'occhio è considerato chiuso
export const X_SLEEP_THRESHOLD = 0.8; // tempo minimo di chiusura occhi dopo il quale il conducente rileva come "dormiente"

export function calculate_ear(landmarks, eye_indices) {
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

// --- FUNZIONE TEXT-TO-SPEECH ---
export const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'it-IT';
    utterance.rate = 1.15; 
    utterance.pitch = 0; 

    // Assegna al volo la prima voce italiana trovata dal browser
    utterance.voice = window.speechSynthesis.getVoices().find(v => v.lang.includes('it')) || null;

    window.speechSynthesis.speak(utterance);
}

// Funzione per formattare i secondi in Minuti:Secondi
export const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); //    Math.floor--> "arrotondare per difetto" tagliando via i decimali
    const s = (totalSeconds % 60).toString().padStart(2, '0');   // Modulo (%) --> calcolare il resto di una divisione. 125 diviso 60 fa 2, con il resto di 5.  .padStart(2, '0') --> "Se il numero ha meno di due cifre, mettici uno zero davanti". Quindi il 2 diventa "02"
    return `${m}m ${s}s`;
};

export const playAlertBeep = () => {
    const audio = new Audio('/beep.mp3');
    audio.play();
};