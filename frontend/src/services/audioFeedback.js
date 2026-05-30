import {speakText} from '../utils/helpers';

// Feedback finale a fine viaggio basato sul punteggio di sicurezza
 export const playEndJourneyFeedback = (score, distractionCount) => {
    const intro = "Viaggio terminato. ";
    let messaggio = "";

    if (score >= 90) {
        messaggio = "Guida eccellente. Hai mantenuto un livello di attenzione ottimale per tutto il tragitto. Ottimo lavoro.";
    } else if (score >= 70) {
        messaggio = "Buona guida, ma c'è margine di miglioramento. Cerca di ridurre le distrazioni minori per mantenere sempre la massima concentrazione.";
    } else if (score >= 40) {
        messaggio = `Attenzione: ho rilevato ${distractionCount} distrazioni durante il percorso. Ti invito a mantenere sempre lo sguardo sulla strada per viaggiare in totale sicurezza.`;
    } else {
        messaggio = `Livello di attenzione critico. Sono state registrate ben ${distractionCount} distrazioni o segni di sonnolenza. Per la tua incolumità, ti consiglio di fare una pausa prima del prossimo viaggio.`;
    }
    speakText(intro + messaggio);
};