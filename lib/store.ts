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
  playlists: Playlist[];
  setCurrentTrack: (track: Track) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setQueue: (queue: Track[]) => void;
  setQueueIndex: (index: number) => void;
  setAuth: (token: string, userId: string) => void;
  setPlaylists: (playlists: Playlist[]) => void;
  toggleShuffle: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  queue: [],
  originalQueue: [],
  queueIndex: 0,
  isShuffle: false,
  token: null,
  userId: null,
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
  setPlaylists: (playlists) => set({ playlists }),
  toggleShuffle: () => set((state) => {
    const newShuffle = !state.isShuffle;
    if (newShuffle) {
      // Shuffle remaining tracks (keep current track at current index or front, simpler: shuffle all and find current)
      const shuffled = [...state.originalQueue].sort(() => Math.random() - 0.5);
      // Put current track first if there is one
      if (state.currentTrack) {
         const currentIdx = shuffled.findIndex(t => t.uid === state.currentTrack?.uid);
         if (currentIdx > -1) {
            shuffled.splice(currentIdx, 1);
            shuffled.unshift(state.currentTrack);
         }
      }
      return { isShuffle: true, queue: shuffled, queueIndex: state.currentTrack ? 0 : 0 };
    } else {
      // Restore original queue
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
    // Loop back to start if at end
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
}));
