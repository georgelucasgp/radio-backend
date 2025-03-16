import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Configurar limites de tamanho do payload
  app.use(json({ limit: '50mb' }));

  // Configuração do CORS
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim());

  logger.log(
    `Configurando CORS para os domínios: ${allowedOrigins.join(', ')}`,
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origem em desenvolvimento
      if (!origin) {
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        logger.warn('Requisição sem origem bloqueada em produção');
        return callback(new Error('Origem não permitida pelo CORS'), false);
      }

      // Remover possível barra no final da origem
      const cleanOrigin = origin.replace(/\/$/, '');

      // Verificar se a origem está na lista de permitidas
      const isAllowed = allowedOrigins.some((allowed) => {
        const cleanAllowed = allowed.replace(/\/$/, '');
        return cleanOrigin === cleanAllowed;
      });

      if (isAllowed) {
        logger.log(`Origem permitida: ${origin}`);
        return callback(null, true);
      }

      // Em desenvolvimento, permitir localhost
      if (
        process.env.NODE_ENV !== 'production' &&
        (cleanOrigin.startsWith('http://localhost') ||
          cleanOrigin.startsWith('http://127.0.0.1'))
      ) {
        logger.log(`Origem local permitida em desenvolvimento: ${origin}`);
        return callback(null, true);
      }

      logger.warn(`Origem bloqueada: ${origin}`);
      callback(new Error('Origem não permitida pelo CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    maxAge: 86400, // 24 horas em segundos
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Aplicação rodando em: http://${host}:${port}`);
}

bootstrap();
