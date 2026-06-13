import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Track {
  uid: string;
  title: string;
  artist: string;
  album: string;
  year?: string;
  length?: number;
  file_id?: string;
  track_url?: string;
  source?: 'ibroadcast' | 'youtube';
  ytId?: string;
  artwork?: string;
}

export interface Playlist {
  uid: string;
  name: string;
  tracks: string[];
}

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  originalQueue: Track[];
  queueIndex: number;
  isShuffle: boolean;
  token: string | null;
  userId: string | null;
  ytCredentials: any | null;
  playlists: Playlist[];
  setCurrentTrack: (track: Track) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[]) => void;
  setQueueIndex: (index: number) => void;
  setAuth: (token: string, userId: string) => void;
  setYtCredentials: (creds: any) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  toggleShuffle: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      queue: [],
      originalQueue: [],
      queueIndex: 0,
      isShuffle: false,
      token: null,
      userId: null,
      ytCredentials: null,
      playlists: [],
      setCurrentTrack: (track) => set((state) => {
        const qIndex = state.queue.findIndex(t => t.uid === track.uid);
        return { currentTrack: track, queueIndex: qIndex !== -1 ? qIndex : state.queueIndex };
      }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setQueue: (queue) => set((state) => {
        if (state.isShuffle) {
          const shuffled = [...queue].sort(() => Math.random() - 0.5);
          return { queue: shuffled, originalQueue: queue };
        }
        return { queue, originalQueue: queue };
      }),
      setQueueIndex: (index) => set({ queueIndex: index }),
      setAuth: (token, userId) => set({ token, userId }),
      setYtCredentials: (creds) => set({ ytCredentials: creds }),
      setPlaylists: (playlists) => set({ playlists }),
      toggleShuffle: () => set((state) => {
        const newShuffle = !state.isShuffle;
        if (newShuffle) {
          const shuffled = [...state.originalQueue].sort(() => Math.random() - 0.5);
          if (state.currentTrack) {
             const currentIdx = shuffled.findIndex(t => t.uid === state.currentTrack?.uid);
             if (currentIdx > -1) {
                shuffled.splice(currentIdx, 1);
                shuffled.unshift(state.currentTrack);
             }
          }
          return { isShuffle: true, queue: shuffled, queueIndex: state.currentTrack ? 0 : 0 };
        } else {
          let newIdx = 0;
          if (state.currentTrack) {
            newIdx = state.originalQueue.findIndex(t => t.uid === state.currentTrack?.uid);
          }
          return { isShuffle: false, queue: state.originalQueue, queueIndex: Math.max(0, newIdx) };
        }
      }),
      playNext: () => set((state) => {
        const nextIndex = state.queueIndex + 1;
        if (nextIndex < state.queue.length) {
          return { queueIndex: nextIndex, currentTrack: state.queue[nextIndex] };
        }
        if (state.queue.length > 0) {
           return { queueIndex: 0, currentTrack: state.queue[0] };
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
    }),
    {
      name: 'shoma-player-storage',
    }
  )
);
