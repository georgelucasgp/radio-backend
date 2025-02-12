export interface AudioMetadata {
  title: string;
  duration: number;
}

export interface QueueItem {
  id: number;
  filepath: string;
  filename: string;
  metadata: AudioMetadata;
  status: 'waiting' | 'playing' | 'finished';
  addedAt: Date;
}

export interface QueueResponse {
  current: QueueItem | null;
  queue: QueueItem[];
  total: number;
}
