import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { ConfigService } from '@nestjs/config';
import { AudioMetadata, QueueItem, QueueItemStatus } from './types';
import * as ytdl from '@distube/ytdl-core';
@Injectable()
export class RadioService {
  private readonly soundDirectory: string;
  private readonly tempDirectory: string;

  constructor(
    @InjectQueue('radio') private readonly radioQueue: Queue<QueueItem>,
    private readonly configService: ConfigService,
  ) {
    this.soundDirectory = path.join(process.cwd(), 'sound');
    this.tempDirectory = this.configService.get('TEMP_DIR') || './temp';

    this.initializeDirectories();
    this.setupQueueProcessor();
  }

  private initializeDirectories(): void {
    this.ensureDirectoryExists(this.soundDirectory);
    this.ensureDirectoryExists(this.tempDirectory);
    this.cleanupSoundDirectory();
  }

  private ensureDirectoryExists(directory: string): void {
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      console.log(`Diretório criado: ${directory}`);
    }
  }

  private cleanupSoundDirectory(): void {
    try {
      const files = fs.readdirSync(this.soundDirectory);
      for (const file of files) {
        fs.unlinkSync(path.join(this.soundDirectory, file));
      }
      console.log('Diretório de músicas limpo com sucesso');
    } catch (error) {
      console.error('Erro ao limpar diretório de músicas:', error);
    }
  }

  private formatTrackTitle(filename: string): string {
    return filename
      .replace(/^\d+-/, '')
      .replace(/\.[^/.]+$/, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private async extractAudioMetadata(filepath: string): Promise<AudioMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filepath, (err: Error | null, metadata: any) => {
        if (err) {
          reject(new Error('Falha ao obter metadados do áudio'));
          return;
        }

        resolve({
          title: this.formatTrackTitle(path.basename(filepath)),
          duration: metadata?.format?.duration || 0,
        });
      });
    });
  }

  private waitForTrackToFinish(durationInSeconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, durationInSeconds * 1000);
      timeout.unref();
    });
  }

  private scheduleTrackFileDeletion(filepath: string): void {
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

  private setupQueueProcessor(): void {
    void this.radioQueue
      .process(1, async (job: Job<QueueItem>) => {
        try {
          const track = job.data;
          console.log(`Processando: ${track.metadata.title}`);

          await this.waitForTrackToFinish(track.metadata.duration);
          this.scheduleTrackFileDeletion(track.filepath);

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
      const filepath = path.join(this.soundDirectory, filename);

      await this.downloadYoutubeAudio(url, filepath);

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

  private async downloadYoutubeAudio(
    url: string,
    outputPath: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ytdl(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
      })
        .pipe(fs.createWriteStream(outputPath))
        .on('finish', resolve)
        .on('error', reject);
    });
  }

  async addToQueue(file: Express.Multer.File): Promise<void> {
    try {
      const timestamp = Date.now();
      const cleanedFilename = this.formatTrackTitle(file.originalname);
      const filename = `${timestamp}-${cleanedFilename.replace(/\s+/g, '_').toLowerCase()}.mp3`;
      const filepath = path.join(this.soundDirectory, filename);

      this.saveAudioFile(file.path, filepath);
      const metadata = await this.extractAudioMetadata(filepath);

      const queueItem = this.createQueueItem(
        filepath,
        filename,
        cleanedFilename,
        metadata,
        timestamp,
      );
      await this.addItemToQueue(queueItem);
    } catch (error) {
      console.error('Erro ao adicionar música:', error);
      throw error;
    }
  }

  private saveAudioFile(sourcePath: string, destinationPath: string): void {
    fs.copyFileSync(sourcePath, destinationPath);
    fs.unlinkSync(sourcePath);
  }

  private createQueueItem(
    filepath: string,
    filename: string,
    title: string,
    metadata: AudioMetadata,
    timestamp: number,
  ): QueueItem {
    return {
      id: timestamp,
      filepath,
      filename,
      metadata: {
        title,
        duration: metadata.duration,
      },
      status: QueueItemStatus.WAITING,
      addedAt: new Date(),
    };
  }

  private async addItemToQueue(queueItem: QueueItem): Promise<void> {
    const activeJobs = await this.radioQueue.getActive();

    if (activeJobs.length === 0) {
      queueItem.status = QueueItemStatus.PLAYING;
      await this.radioQueue.add(queueItem);
      console.log(`Iniciando reprodução: ${queueItem.metadata.title}`);
    } else {
      await this.radioQueue.add(queueItem);
      console.log(`Música adicionada à fila: ${queueItem.metadata.title}`);
    }
  }

  async getCurrentTrack(): Promise<QueueItem | null> {
    try {
      const activeJobs = await this.radioQueue.getActive();
      return activeJobs?.[0]?.data || null;
    } catch (error) {
      console.error('Erro ao buscar música atual:', error);
      return null;
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    try {
      const waitingJobs = await this.radioQueue.getWaiting();
      return waitingJobs.map((job) => job.data);
    } catch (error) {
      console.error('Erro ao buscar fila:', error);
      return [];
    }
  }

  async clearQueue(): Promise<void> {
    try {
      this.deleteAllAudioFiles();
      await this.radioQueue.empty();
      console.log('Fila limpa com sucesso');
    } catch (error) {
      console.error('Erro ao limpar fila:', error);
      throw error;
    }
  }

  private deleteAllAudioFiles(): void {
    const files = fs.readdirSync(this.soundDirectory);
    for (const file of files) {
      fs.unlinkSync(path.join(this.soundDirectory, file));
    }
  }

  private getIcecastUrl(): string {
    const host = this.configService.get('ICECAST_HOST') || 'localhost';
    const port = '8005'; // Porta do harbor do Liquidsoap
    const password =
      this.configService.get('ICECAST_SOURCE_PASSWORD') || 'hackme';
    const mount = '/voice.mp3'; // Mountpoint fixo para o harbor

    return `icecast://source:${password}@${host}:${port}${mount}`;
  }

  private async saveTemporaryFile(
    buffer: Buffer,
    extension: string = 'webm',
  ): Promise<string> {
    const tempFile = path.join(
      this.tempDirectory,
      `temp-${Date.now()}.${extension}`,
    );

    this.ensureDirectoryExists(this.tempDirectory);
    fs.writeFileSync(tempFile, buffer);

    if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
      throw new Error('Erro ao salvar arquivo temporário');
    }

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

      const isValid = await this.verifyWebmFile(tempFile);
      if (!isValid) {
        throw new Error('Arquivo WebM inválido ou corrompido');
      }

      const icecastUrl = this.getIcecastUrl();
      console.log(
        'Enviando áudio para o harbor do Liquidsoap para mixagem:',
        icecastUrl,
      );

      return await this.streamAudioToIcecast(tempFile, icecastUrl);
    } catch (err) {
      if (tempFile) {
        this.cleanupFile(tempFile);
      }
      throw err;
    }
  }

  private async streamAudioToIcecast(
    inputFile: string,
    outputUrl: string,
  ): Promise<{ success: boolean }> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(inputFile)
        .inputFormat('webm')
        .inputOptions(['-re']) // Lê o input em tempo real
        .outputFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .outputOptions(['-content_type audio/mpeg'])
        .output(outputUrl, { end: true })
        .on('start', (commandLine) => {
          console.log('Comando FFmpeg:', commandLine);
        })
        .on('end', () => {
          console.log('Transmissão finalizada com sucesso');
          this.cleanupFile(inputFile);
          resolve({ success: true });
        })
        .on('error', (err) => {
          console.error('Erro FFmpeg detalhado:', err);
          this.cleanupFile(inputFile);
          reject(new Error(`Erro na conversão: ${err.message}`));
        })
        .run();
    });
  }
}
