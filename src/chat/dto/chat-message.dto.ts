export class ChatUserDto {
  name: string;
  avatar?: string;
}

export class ChatMessageDto {
  user: ChatUserDto;
  content: string;
}

export class ChatMessageResponseDto extends ChatMessageDto {
  id: string;
  timestamp: Date;
}
