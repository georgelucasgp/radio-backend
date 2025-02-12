import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { RadioController } from './radio.controller';
import { RadioService } from './radio.service';
import { BullModule } from '@nestjs/bull';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      dest: process.env.TEMP_DIR || './temp',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'radio',
    }),
    BullBoardModule.forFeature({
      name: 'radio',
      adapter: BullAdapter,
    }),
  ],
  controllers: [RadioController],
  providers: [RadioService],
})
export class RadioModule {}
