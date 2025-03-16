# Build stage
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Instalar pnpm
RUN npm install -g pnpm

# Instalar dependências
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copiar código e buildar
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-bullseye-slim

WORKDIR /app

# Copiar package.json e pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Instalar apenas dependências de produção
RUN npm install -g pnpm && pnpm install --prod

# Copiar build e node_modules
COPY --from=builder /app/dist ./dist

# Instalar ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Criar diretórios necessários
RUN mkdir -p sound temp

EXPOSE 3000

# Usar node diretamente
CMD ["node", "dist/main"] 