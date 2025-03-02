import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Configuração do CORS
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';

  logger.log(`Configurando CORS para o domínio: ${allowedOrigin}`);

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origem (como mobile apps ou curl) apenas em desenvolvimento
      if (!origin) {
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('Origem não permitida pelo CORS'), false);
      }

      // Verificar se a origem é exatamente a permitida
      if (
        origin === allowedOrigin ||
        origin === allowedOrigin.replace(/\/$/, '')
      ) {
        return callback(null, true);
      }

      // Em ambiente de desenvolvimento, permitir localhost
      if (
        process.env.NODE_ENV !== 'production' &&
        (origin.startsWith('http://localhost') ||
          origin.startsWith('http://127.0.0.1'))
      ) {
        return callback(null, true);
      }

      logger.warn(`Bloqueando requisição de origem não permitida: ${origin}`);
      callback(new Error('Origem não permitida pelo CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 horas em segundos
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Aplicação rodando na porta ${port}`);
}
bootstrap();
