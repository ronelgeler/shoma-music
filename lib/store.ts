import { create } from 'zustand';

export interface Track {
  uid: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  length?: number;
  file_id?: string;
  track_url?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  token: string | null;
  userId: string | null;
  setCurrentTrack: (track: Track) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[]) => void;
  setQueueIndex: (index: number) => void;
  setAuth: (token: string, userId: string) => void;
  playNext: () => void;
  playPrevious: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  queueIndex: 0,
  token: null,
  userId: null,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setQueue: (queue) => set({ queue }),
  setQueueIndex: (index) => set({ queueIndex: index }),
  setAuth: (token, userId) => set({ token, userId }),
  playNext: () => set((state) => {
    const nextIndex = state.queueIndex + 1;
    if (nextIndex < state.queue.length) {
      return { queueIndex: nextIndex, currentTrack: state.queue[nextIndex] };
    }
    return state;
  }),
  playPrevious: () => set((state) => {
    const prevIndex = state.queueIndex - 1;
    if (prevIndex >= 0) {
      return { queueIndex: prevIndex, currentTrack: state.queue[prevIndex] };
    }
    return state;
  }),
}));
