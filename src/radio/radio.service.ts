import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { ConfigService } from '@nestjs/config';
import { AudioMetadata, QueueItem } from './types';
import * as ytdl from '@distube/ytdl-core';

@Injectable()
export class RadioService {
  private readonly soundDir = path.join(process.cwd(), 'sound');

  constructor(
    @InjectQueue('radio') private readonly radioQueue: Queue<QueueItem>,
    private configService: ConfigService,
  ) {
    this.initializeDirectory();
    this.initializeQueueProcessor();
  }

  private initializeDirectory(): void {
    if (!fs.existsSync(this.soundDir)) {
      fs.mkdirSync(this.soundDir, { recursive: true });
    }
    this.cleanupDirectory();
  }

  private cleanupDirectory(): void {
    try {
      const files = fs.readdirSync(this.soundDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.soundDir, file));
      }
      console.log('Diretório de músicas limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar diretório:', error);
    }
  }

  private cleanTitle(filename: string): string {
    return filename
      .replace(/^\d+-/, '')
      .replace(/\.[^/.]+$/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private async getAudioMetadata(filepath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error('Falha ao obter metadados do áudio'));
          return;
        }

        resolve({
          title: this.cleanTitle(path.basename(filepath)),
          duration: metadata?.format?.duration || 0,
        });
      });
    });
  }

  private waitTrackDuration(duration: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, duration * 1000);
      timeout.unref();
    });
  }

  private removeTrackFile(filepath: string): void {
    try {
      if (fs.existsSync(filepath)) {
        setTimeout(() => {
          fs.unlinkSync(filepath);
          console.log(`Arquivo removido: ${filepath}`);
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
      throw error;
    }
  }

  private initializeQueueProcessor(): void {
    void this.radioQueue
      .process(1, async (job: Job<QueueItem>) => {
        try {
          const track = job.data;
          console.log(`Processando: ${track.metadata.title}`);

          await this.waitTrackDuration(track.metadata.duration);
          this.removeTrackFile(track.filepath);

          // Não precisa adicionar a próxima música aqui
          // O Bull já vai processar o próximo job da fila automaticamente

          return track;
        } catch (error) {
          console.error('Erro ao processar música:', error);
          throw error;
        }
      })
      .catch((error) => {
        console.error('Erro fatal no processador de fila:', error);
      });
  }

  async addFromYoutube(url: string): Promise<void> {
    try {
      const info = await ytdl.getInfo(url);
      const videoTitle = info.videoDetails.title
        .replace(/[^a-z0-9\s]/gi, ' ')
        .trim();

      const timestamp = Date.now();
      const filename = `${timestamp}-${videoTitle.replace(/\s+/g, '_').toLowerCase()}.mp3`;
      const filepath = path.join(this.soundDir, filename);

      await new Promise<void>((resolve, reject) => {
        ytdl(url, {
          filter: 'audioonly',
          quality: 'highestaudio',
        })
          .pipe(fs.createWriteStream(filepath))
          .on('finish', resolve)
          .on('error', reject);
      });

      await this.addToQueue({
        originalname: videoTitle,
        path: filepath,
      } as Express.Multer.File);

      console.log(
        `Música do YouTube baixada e adicionada à fila: ${videoTitle}`,
      );
    } catch (error) {
      console.error('Erro ao baixar do YouTube:', error);
      throw error;
    }
  }

  async addToQueue(file: Express.Multer.File): Promise<void> {
    try {
      const timestamp = Date.now();
      const cleanedFilename = this.cleanTitle(file.originalname);
      const filename = `${timestamp}-${cleanedFilename.replace(/\s+/g, '_').toLowerCase()}.mp3`;
      const filepath = path.join(this.soundDir, filename);

      fs.copyFileSync(file.path, filepath);
      fs.unlinkSync(file.path);

      const metadata = await this.getAudioMetadata(filepath);

      // Sempre cria o item da fila
      const queueItem: QueueItem = {
        id: timestamp,
        filepath,
        filename,
        metadata: {
          title: cleanedFilename,
          duration: metadata.duration,
        },
        status: 'waiting',
        addedAt: new Date(),
      };

      // Verifica se há jobs ativos antes de adicionar
      const activeJobs = await this.radioQueue.getActive();
      if (activeJobs.length === 0) {
        // Se não houver jobs ativos, marca como playing e adiciona
        queueItem.status = 'playing';
        await this.radioQueue.add(queueItem);
        console.log(`Iniciando reprodução: ${cleanedFilename}`);
      } else {
        // Se já houver jobs, apenas adiciona à fila
        await this.radioQueue.add(queueItem);
        console.log(`Música adicionada à fila: ${cleanedFilename}`);
      }
    } catch (error) {
      console.error('Erro ao adicionar música:', error);
      throw error;
    }
  }

  async getCurrentTrack(): Promise<QueueItem | null> {
    try {
      // Em vez de ler arquivos, pega o job ativo do Bull
      const activeJobs = await this.radioQueue.getActive();
      return activeJobs?.[0]?.data || null;
    } catch (error) {
      console.error('Erro ao buscar música atual:', error);
      return null;
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    try {
      // Em vez de ler arquivos, pega os jobs em espera do Bull
      const waitingJobs = await this.radioQueue.getWaiting();
      return waitingJobs.map((job) => job.data);
    } catch (error) {
      console.error('Erro ao buscar fila:', error);
      return [];
    }
  }

  async clearQueue(): Promise<void> {
    try {
      // Limpa os arquivos físicos
      const files = fs.readdirSync(this.soundDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.soundDir, file));
      }
      // Limpa a fila no Bull
      await this.radioQueue.empty();
      console.log('Fila limpa com sucesso');
    } catch (error) {
      console.error('Erro ao limpar fila:', error);
      throw error;
    }
  }

  private getLiquidsoapUrl(): string {
    const host = this.configService.get('HOST') || 'localhost';
    const password =
      this.configService.get('ICECAST_SOURCE_PASSWORD') || 'hackme';
    return `http://source:${password}@${host}:8005/voice`;
  }

  private async saveTemporaryFile(
    buffer: Buffer,
    extension: string = 'webm',
  ): Promise<string> {
    const tempDir = (this.configService.get('TEMP_DIR') as string) || './temp';
    const tempFile = path.join(tempDir, `temp-${Date.now()}.${extension}`);

    // Garante que o diretório temporário existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Salva o arquivo temporariamente de forma síncrona
    fs.writeFileSync(tempFile, buffer);

    // Verifica se o arquivo foi salvo corretamente
    if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
      throw new Error('Erro ao salvar arquivo temporário');
    }

    // Aguarda um momento para garantir que o arquivo foi escrito completamente
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve(tempFile), 100);
    });
  }

  private async verifyWebmFile(filePath: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Erro ao verificar arquivo WebM:', err);
          resolve(false);
          return;
        }

        const isValid =
          metadata?.format?.format_name?.includes('webm') || false;
        if (!isValid) {
          console.error('Arquivo não é um WebM válido');
        }
        resolve(isValid);
      });
    });
  }

  private cleanupFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async streamToIcecast(
    file: Express.Multer.File,
  ): Promise<{ success: boolean }> {
    let tempFile = '';

    try {
      tempFile = await this.saveTemporaryFile(file.buffer);
      console.log('Arquivo temporário salvo:', tempFile);

      // Verifica se o arquivo é válido
      const isValid = await this.verifyWebmFile(tempFile);
      if (!isValid) {
        throw new Error('Arquivo WebM inválido ou corrompido');
      }

      const liquidSoapUrl = this.getLiquidsoapUrl();
      console.log('Tentando transmitir para Liquidsoap:', liquidSoapUrl);

      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(tempFile)
          .inputFormat('webm')
          .inputOptions(['-re']) // Lê o input em tempo real
          .outputFormat('mp3')
          .audioCodec('libmp3lame')
          .audioBitrate('128k')
          .audioChannels(2)
          .audioFrequency(44100)
          .outputOptions(['-content_type audio/mpeg'])
          .output(liquidSoapUrl, { end: true })
          .on('start', (commandLine) => {
            console.log('Comando FFmpeg:', commandLine);
          })
          .on('progress', (progress) => {
            console.log('Progresso:', progress);
          })
          .on('end', () => {
            console.log('Transmissão finalizada com sucesso');
            this.cleanupFile(tempFile);
            resolve({ success: true });
          })
          .on('error', (err) => {
            console.error('Erro FFmpeg detalhado:', err);
            this.cleanupFile(tempFile);
            reject(new Error(`Erro na conversão: ${err.message}`));
          })
          .run();
      });
    } catch (err) {
      if (tempFile) {
        this.cleanupFile(tempFile);
      }
      throw err;
    }
  }
}
