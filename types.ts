
export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface User {
  username: string;
  email: string;
  avatar?: string;
  isLoggedIn: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR'
}

export type Category = 'All' | 'Political' | 'Economical' | 'Social' | 'Recommended' | 'Feed' | 'SocialMedia';

export type SpeechRate = 'slow' | 'normal' | 'fast';

export interface AudioVisualizerProps {
  isActive: boolean;
  analyzer?: AnalyserNode;
}
