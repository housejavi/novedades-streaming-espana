FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .

# Carpeta para la caché persistente de IDs (mapear como volumen si
# quieres conservarla entre despliegues).
RUN mkdir -p /app/data

ENV PORT=7000
EXPOSE 7000

CMD ["node", "server.js"]
