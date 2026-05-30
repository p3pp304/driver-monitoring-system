import os
from datetime import datetime 
from google import genai

# Inizializzazione del client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

AI_COOLDOWN_SECONDS = 600 # 600 secondi= 10 MINUTI
fallback_message = f"Ho rilevato una chiusura occhi di {x} secondi. Accosta subito in un'area sicura per riposare."

async def genera_assistenza_vocale(x, last_ai_response_time):
    now = datetime.now()

    if last_ai_response_time:
        secondi_trascorsi = (now - last_ai_response_time).total_seconds()
        
        if secondi_trascorsi < AI_COOLDOWN_SECONDS:
            minuti_rimanenti = int((AI_COOLDOWN_SECONDS - secondi_trascorsi) / 60)
            print(f"Timer attivo: mancano {minuti_rimanenti} minuti alla prossima chiamata IA. Ho applicato risposta pre-impostata.")
            #Fallback
            return fallback_message , last_ai_response_time
            
    prompt = f"Il conducente ha chiuso gli occhi per {x} secondi. Genera una frase brevissima (max 15 parole) per avvertirlo della pericolosità della situazione e consigliargli di accostare immediatamente. Sottolinea anche il tempo di chiusura degli occhi per enfatizzare il rischio. Non mettere nulla in grassetto o in corsivo e non usare emoji. Rispondi solo con la frase, senza introduzioni o spiegazioni. Cerca di essere molto diretto e chiaro, come se stessi parlando a un guidatore in pericolo imminente."
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
        )
        return response.text, now
        
    except Exception as e:
        print(f"Errore durante la chiamata Gemini: {e}. Applicata risposta pre-impostata.")
        #Fallback
        return fallback_message , last_ai_response_time