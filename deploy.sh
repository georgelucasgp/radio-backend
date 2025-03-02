#!/bin/bash

# Script de implantação para o projeto Radio DoubleG na AWS EC2
# Uso: ./deploy.sh [--build]

set -e

echo "🚀 Iniciando implantação do Radio DoubleG..."

# Verificar se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado. Instalando..."
    sudo apt-get update
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get update
    sudo apt-get install -y docker-ce
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado com sucesso!"
else
    echo "✅ Docker já está instalado."
fi

# Verificar se o Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não encontrado. Instalando..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.6/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose instalado com sucesso!"
else
    echo "✅ Docker Compose já está instalado."
fi

# Verificar se deve reconstruir as imagens
if [[ "$1" == "--build" ]]; then
    echo "🔨 Reconstruindo imagens..."
    docker-compose -f docker-compose.prod.yml build
fi

# Iniciar os contêineres
echo "🚀 Iniciando contêineres..."
docker-compose -f docker-compose.prod.yml up -d

# Verificar status
echo "🔍 Verificando status dos contêineres..."
docker-compose -f docker-compose.prod.yml ps

# Obter o IP público da instância EC2
PUBLIC_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me)

echo "✅ Implantação concluída com sucesso!"
echo "📻 Rádio DoubleG está disponível em:"
echo "   - API Backend: http://$PUBLIC_IP:3000"
echo "   - Icecast: http://$PUBLIC_IP:8000"
echo "   - Stream de Rádio: http://$PUBLIC_IP:8000/radio.mp3"
echo "   - Stream de Voz: http://$PUBLIC_IP:8000/voice.mp3"

echo "📝 Para verificar os logs, use:"
echo "   - Backend: docker logs radio-backend"
echo "   - Liquidsoap: docker logs liquidsoap"
echo "   - Icecast: docker logs icecast" 