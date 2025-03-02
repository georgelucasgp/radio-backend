import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsResponse,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway inicializado');
    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';
    this.logger.log(`CORS configurado para: ${allowedOrigin}`);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);

    // Verificar a origem da conexão
    const origin = client.handshake.headers.origin;
    const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (
      process.env.NODE_ENV === 'production' &&
      origin !== allowedOrigin &&
      origin !== allowedOrigin.replace(/\/$/, '') &&
      !origin?.startsWith('http://localhost')
    ) {
      this.logger.warn(`Conexão bloqueada de origem não permitida: ${origin}`);
      client.disconnect();
      return;
    }

    const recentMessages = this.chatService.getRecentMessages();
    client.emit('recent-messages', recentMessages);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessageDto,
  ): WsResponse<any> {
    try {
      if (!payload) {
        throw new Error('Payload vazio');
      }

      if (!payload.content || payload.content.trim() === '') {
        throw new Error('Conteúdo da mensagem não pode ser vazio');
      }

      if (
        !payload.user ||
        !payload.user.name ||
        payload.user.name.trim() === ''
      ) {
        throw new Error('Nome de usuário é obrigatório');
      }

      this.logger.log(`Mensagem recebida de ${client.id}: ${payload.content}`);

      const message = this.chatService.saveMessage({
        user: payload.user,
        content: payload.content.trim(),
      });

      this.server.emit('message', message);

      return { event: 'message', data: { success: true } };
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem: ${error.message}`);

      client.emit('error', error.message);

      return {
        event: 'message',
        data: { success: false, error: error.message },
      };
    }
  }
}
