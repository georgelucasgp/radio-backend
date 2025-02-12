import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RadioService } from './radio.service';
import { diskStorage, memoryStorage } from 'multer';
import { QueueResponse } from './types';

@Controller('radio')
export class RadioController {
  constructor(private readonly radioService: RadioService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './temp',
        filename: (req, file, cb) => {
          if (!file.mimetype.match(/^audio\/(mpeg|wav|ogg|x-m4a)$/)) {
            return cb(
              new Error('Apenas arquivos de áudio são permitidos!'),
              '',
            );
          }
          cb(null, file.originalname);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 50 }), // 50MB max
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    await this.radioService.addToQueue(file);
    return {
      message: 'Arquivo adicionado à fila com sucesso',
      filename: file.originalname,
    };
  }

  @Post('youtube')
  async addFromYoutube(@Body('url') url: string) {
    await this.radioService.addFromYoutube(url);
    return {
      message: 'Música do YouTube adicionada à fila com sucesso',
    };
  }

  @Get('queue')
  async getQueue(): Promise<QueueResponse> {
    const current = await this.radioService.getCurrentTrack();
    const queue = await this.radioService.getQueue();

    return {
      current: current || null,
      queue,
      total: queue.length,
    };
  }

  @Post('clear')
  async clearQueue() {
    await this.radioService.clearQueue();
    return { message: 'Fila limpa com sucesso' };
  }

  @Get('now-playing')
  async getCurrentTrack() {
    try {
      const currentTrack = await this.radioService.getCurrentTrack();
      return { track: currentTrack || null };
    } catch (err) {
      console.error('Erro ao buscar música atual:', err);
      throw new HttpException(
        'Erro ao buscar música atual',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('stream')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: {
        fileSize: 1024 * 1024 * 5, // 5MB max
      },
    }),
  )
  async streamAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException(
        'Nenhum arquivo de áudio recebido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.radioService.streamToIcecast(file);
    } catch (err) {
      console.error('Erro ao processar áudio:', err);
      throw new HttpException(
        'Erro ao processar áudio',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
