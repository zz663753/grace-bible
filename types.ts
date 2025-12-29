
export interface BibleBook {
  id: string;
  name: string;
  chapters: number;
  testament: 'Old' | 'New';
}

export interface ReadingProgress {
  [bookId: string]: number[]; // Array of completed chapter numbers
}

export interface ChapterContent {
  bookName: string;
  chapter: number;
  content: string;
}

export enum AudioState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}
