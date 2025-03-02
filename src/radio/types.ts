export interface AudioMetadata {
  title: string;
  duration: number;
}

export enum QueueItemStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

export interface QueueItem {
  id: number;
  filepath: string;
  filename: string;
  metadata: AudioMetadata;
  status: QueueItemStatus;
  addedAt: Date;
}

export interface QueueResponse {
  current: QueueItem | null;
  queue: QueueItem[];
  total: number;
}
