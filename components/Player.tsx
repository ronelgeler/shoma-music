'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/lib/store';
import { getStreamUrl } from '@/lib/ibroadcast';
import { Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';

export default function Player() {
  const { currentTrack, isPlaying, setIsPlaying, playNext, playPrevious, token, userId } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, setIsPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleEnded = () => {
    playNext();
  };

  if (!currentTrack || !token || !userId) return null;

  const streamUrl = getStreamUrl(currentTrack.uid, token, userId);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 text-white">
      <audio
        ref={audioRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        autoPlay={isPlaying}
      />
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4 w-1/3">
          <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center">
            <span className="text-neutral-500 text-xs">No Cover</span>
          </div>
          <div>
            <div className="font-semibold text-sm line-clamp-1">{currentTrack.title}</div>
            <div className="text-neutral-400 text-xs line-clamp-1">{currentTrack.artist}</div>
          </div>
        </div>

        <div className="flex flex-col items-center w-1/3">
          <div className="flex items-center space-x-6">
            <button onClick={playPrevious} className="text-neutral-400 hover:text-white transition">
              <SkipBack size={20} />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
            </button>
            <button onClick={playNext} className="text-neutral-400 hover:text-white transition">
              <SkipForward size={20} />
            </button>
          </div>
          <div className="w-full max-w-md mt-2 h-1 bg-neutral-700 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-end w-1/3 space-x-3 text-neutral-400">
          <Volume2 size={20} />
          <div className="w-24 h-1 bg-neutral-700 rounded-full overflow-hidden">
             <div className="h-full bg-white" style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
