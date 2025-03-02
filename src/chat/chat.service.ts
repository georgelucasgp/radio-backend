import { Injectable, Logger } from '@nestjs/common';
import { ChatMessageDto, ChatMessageResponseDto } from './dto/chat-message.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private messages: ChatMessageResponseDto[] = [];
  private readonly MAX_MESSAGES = 100; // Limite de mensagens armazenadas em memória

  constructor() {
    this.messages = [
      {
        id: '1',
        user: {
          name: 'Sistema',
          avatar: '',
        },
        content: 'Bem-vindo ao chat da rádio! 🎵',
        timestamp: new Date(),
      },
    ];
  }

  saveMessage(messageDto: ChatMessageDto): ChatMessageResponseDto {
    if (!messageDto.content || messageDto.content.trim() === '') {
      this.logger.warn('Tentativa de salvar mensagem vazia');
      throw new Error('Mensagem não pode ser vazia');
    }

    if (
      !messageDto.user ||
      !messageDto.user.name ||
      messageDto.user.name.trim() === ''
    ) {
      this.logger.warn('Tentativa de salvar mensagem sem nome de usuário');
      throw new Error('Nome de usuário é obrigatório');
    }

    const message: ChatMessageResponseDto = {
      id: Date.now().toString(),
      user: messageDto.user,
      content: messageDto.content.trim(),
      timestamp: new Date(),
    };

    this.messages.push(message);

    if (this.messages.length > this.MAX_MESSAGES) {
      this.messages = this.messages.slice(-this.MAX_MESSAGES);
    }

    this.logger.log(`Mensagem salva: ${message.id}`);
    return message;
  }

  getRecentMessages(): ChatMessageResponseDto[] {
    return this.messages.slice(-50);
  }
}
