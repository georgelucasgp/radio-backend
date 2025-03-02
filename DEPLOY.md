# Guia de Deploy do Backend

Este guia explica como configurar e fazer deploy do backend da Rádio DoubleG em um servidor.

## Pré-requisitos

- Servidor Linux (Ubuntu/Debian recomendado)
- Docker e Docker Compose instalados
- Acesso SSH ao servidor
- Domínio configurado (opcional, mas recomendado)

## Configuração do Ambiente

1. Clone o repositório no servidor:
   ```bash
   git clone https://github.com/seu-usuario/radio-backend.git
   cd radio-backend
   ```

2. Crie o arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Edite o arquivo `.env` com as configurações corretas:
   ```bash
   nano .env
   ```

   Atualize as seguintes variáveis:
   - `PORT`: Porta em que o backend rodará (padrão: 3000)
   - `FRONTEND_URL`: URL do frontend (ex: https://radiodoubleg.vercel.app)
   - `ICECAST_SOURCE_PASSWORD`: Senha para transmissão (use uma senha forte)
   - `ICECAST_PASSWORD`: Senha de administração do Icecast (use uma senha forte)

   **Importante**: A configuração de CORS foi ajustada para aceitar apenas um domínio específico. Certifique-se de que o valor de `FRONTEND_URL` corresponda exatamente ao domínio do seu frontend, incluindo o protocolo (https://) e sem barra no final.

## Deploy com Docker

1. Certifique-se de que o Docker e o Docker Compose estão instalados:
   ```bash
   docker --version
   docker-compose --version
   ```

2. Execute o script de deploy:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh --build
   ```

   Este script irá:
   - Verificar se o Docker e o Docker Compose estão instalados
   - Construir as imagens Docker
   - Iniciar os contêineres
   - Verificar o status dos contêineres

## Configuração do Nginx (Opcional, mas Recomendado)

Para expor o backend e o streaming com HTTPS, configure o Nginx como proxy reverso:

1. Instale o Nginx e o Certbot:
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. Crie uma configuração para o backend:
   ```bash
   sudo nano /etc/nginx/sites-available/radio-backend
   ```

   Adicione o seguinte conteúdo:
   ```nginx
   server {
       listen 80;
       server_name api.radio-doubleg.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

3. Crie uma configuração para o streaming:
   ```bash
   sudo nano /etc/nginx/sites-available/radio-streaming
   ```

   Adicione o seguinte conteúdo:
   ```nginx
   server {
       listen 80;
       server_name stream.radio-doubleg.com;

       location / {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. Ative as configurações:
   ```bash
   sudo ln -s /etc/nginx/sites-available/radio-backend /etc/nginx/sites-enabled/
   sudo ln -s /etc/nginx/sites-available/radio-streaming /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. Configure o HTTPS com Certbot:
   ```bash
   sudo certbot --nginx -d api.radio-doubleg.com -d stream.radio-doubleg.com
   ```

## Verificação do Deploy

Após o deploy, verifique se:

1. O backend está rodando corretamente:
   ```bash
   curl http://localhost:3000
   ```

2. O streaming está funcionando:
   ```bash
   curl http://localhost:8000
   ```

3. Se configurou o Nginx, verifique os domínios:
   ```bash
   curl https://api.radio-doubleg.com
   curl https://stream.radio-doubleg.com
   ```

## Monitoramento e Logs

Para monitorar os contêineres:
```bash
docker-compose -f docker-compose.prod.yml ps
```

Para ver os logs:
```bash
# Backend
docker logs radio-backend

# Liquidsoap
docker logs liquidsoap

# Icecast
docker logs icecast
```

## Atualização

Para atualizar o backend:

1. Faça pull das alterações:
   ```bash
   git pull
   ```

2. Execute o script de deploy:
   ```bash
   ./deploy.sh --build
   ```

## Solução de Problemas

Se encontrar problemas com CORS:

1. Verifique se a variável `FRONTEND_URL` no arquivo `.env` está configurada corretamente
   - Deve ser exatamente igual ao domínio do frontend (ex: https://radiodoubleg.vercel.app)
   - Não deve ter barra no final
   - Deve incluir o protocolo (https://)

2. Verifique os logs do backend para mensagens de erro relacionadas ao CORS:
   ```bash
   docker logs radio-backend | grep -i cors
   ```

3. Reinicie o backend:
   ```bash
   docker-compose -f docker-compose.prod.yml restart radio-backend
   ```

Para problemas com o streaming:

1. Verifique os logs do Icecast e do Liquidsoap
2. Certifique-se de que as portas 3000 e 8000 estão abertas no firewall 