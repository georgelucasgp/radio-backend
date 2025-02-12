import { Module } from '@nestjs/common';
import { RadioModule } from './radio/radio.module';
import { BullBoardConfigModule } from './bull-board/bull-board.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RadioModule,
    BullBoardConfigModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
