# Usiamo un'immagine Python ottimizzata per applicazioni AI
FROM python:3.10-slim

# Installiamo dipendenze di sistema necessarie per OpenCV/MediaPipe
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Avvio con auto-reload per lo sviluppo
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]