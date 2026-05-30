FROM python:3.10-slim

WORKDIR /app

# Installazione delle dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Avvio del server ASGI con auto-reload sulla porta 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]