import os
import google.generativeai as genai
from dotenv import load_dotenv

# Carica le variabili dal file .env (dove metterai GEMINI_API_KEY)
load_dotenv()

# Configurazione iniziale con la tua API Key
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Scegliamo il modello Flash per la massima reattività
model = genai.GenerativeModel('gemini-1.5-flash')

async def genera_assistenza_vocale(motivo_allarme):
    prompt = f"Il conducente ha avuto un colpo di sonno per {motivo_allarme}. Genera una singola frase breve (massimo 15 parole) per svegliarlo e dirgli di accostare."
    
    # Avviamo la richiesta in modalità stream
    risposta_stream = model.generate_content(prompt, stream=True)
    
    # Restituiamo i pezzettini di testo man mano che arrivano
    for chunk in risposta_stream:
        # Puliamo eventuali ritorni a capo per evitare problemi di formattazione JSON
        testo_pulito = chunk.text.replace("\n", " ")
        yield testo_pulito