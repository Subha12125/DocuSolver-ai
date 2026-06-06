export interface QAPair {
  question: string;
  answer: string;
  diagram?: string;
  image?: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_PDF = 'READING_PDF',
  ANALYZING = 'ANALYZING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface ProcessingState {
  status: ProcessingStatus;
  message?: string;
  progress?: number;
}