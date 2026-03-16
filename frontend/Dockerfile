FROM node:20-slim

WORKDIR /app

# Installazione dipendenze (sfruttando la cache dei layer)
COPY package*.json ./
RUN npm install

# Copia sorgenti
COPY . .

EXPOSE 5173

# Avvio Vite con accesso esterno abilitato
CMD ["npm", "run", "dev", "--", "--host"]