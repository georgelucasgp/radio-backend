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
          cb(null, file.originalname);
        },
      }),
      fileFilter: (req, file, cb) => {
        const isAudio = file.mimetype.match(/^audio\/(mpeg|wav|ogg|x-m4a)$/);
        if (!isAudio) {
          return cb(
            new Error('Apenas arquivos de áudio são permitidos!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAudioFile(
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
  async addYoutubeTrackToQueue(@Body('url') url: string) {
    if (!url) {
      throw new HttpException(
        'URL do YouTube é obrigatória',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.radioService.addFromYoutube(url);
    return {
      message: 'Música do YouTube adicionada à fila com sucesso',
    };
  }

  @Get('queue')
  async getPlaybackQueue(): Promise<QueueResponse> {
    const current = await this.radioService.getCurrentTrack();
    const queue = await this.radioService.getQueue();

    return {
      current: current || null,
      queue,
      total: queue.length,
    };
  }

  @Post('clear')
  async clearPlaybackQueue() {
    await this.radioService.clearQueue();
    return { message: 'Fila limpa com sucesso' };
  }

  @Get('now-playing')
  async getCurrentPlayingTrack() {
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
  async streamAudioToIcecast(@UploadedFile() file: Express.Multer.File) {
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
        'Erro ao processar áudio para Icecast',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
