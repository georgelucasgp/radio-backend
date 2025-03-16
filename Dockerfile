FROM node:20-bullseye-slim

# Definir diretório de trabalho
WORKDIR /app

# Instalar dependências do sistema, incluindo ffmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar pnpm globalmente
RUN npm install -g pnpm@latest

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar o código-fonte
COPY . .

# Criar diretórios necessários
RUN mkdir -p sound temp

# Compilar o projeto
RUN pnpm run build

# Expor a porta usada pelo NestJS
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["pnpm", "run", "start:prod"] 