import os
from datetime import datetime 
from google import genai

# Inizializzazione del client
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

# Variabili di stato
last_ai_response_time = None
AI_COOLDOWN_SECONDS = 600

async def genera_assistenza_vocale(x):
    global last_ai_response_time
    now = datetime.now()

    # Controlliamo il timer solo se c'è stata una chiamata precedente
    if last_ai_response_time:
        secondi_trascorsi = (now - last_ai_response_time).total_seconds()
        
        if secondi_trascorsi < AI_COOLDOWN_SECONDS:
            minuti_rimanenti = int((AI_COOLDOWN_SECONDS - secondi_trascorsi) / 60)
            print(f"Timer attivo: mancano {minuti_rimanenti} minuti alla prossima chiamata IA. Ho applicato risposta pre-impostata.")
            
            # Fallback pulito senza asterischi per il sintetizzatore vocale
            return f"Ho rilevato una chiusura occhi di {x} secondi. Accosta subito in un'area sicura per riposare."
            

    # Il prompt rimane rigoroso per evitare che l'IA generi punteggiatura strana
    prompt = f"Il conducente ha chiuso gli occhi per {x} secondi. Genera una frase brevissima (max 15 parole) per avvertirlo della pericolosità della situazione e consigliargli di accostare immediatamente. Sottolinea anche il tempo di chiusura degli occhi per enfatizzare il rischio. Non mettere nulla in grassetto o in corsivo e non usare emoji. Rispondi solo con la frase, senza introduzioni o spiegazioni. Cerca di essere molto diretto e chiaro, come se stessi parlando a un guidatore in pericolo imminente."
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt,
        )
        
        last_ai_response_time = datetime.now()
        return response.text
        
    except Exception as e:
        print(f"Errore durante la chiamata Gemini: {e}. Applicata risposta pre-impostata.")
        # Fallback pulito anche in caso di crash dell'API
        return f"Ho rilevato una chiusura occhi di {x} secondi. Accosta subito in un'area sicura per riposare."