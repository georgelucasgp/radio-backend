import { Module } from '@nestjs/common';
import { RadioModule } from './radio/radio.module';
import { BullBoardConfigModule } from './bull-board/bull-board.module';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from './chat/chat.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RadioModule,
    BullBoardConfigModule,
    ChatModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
