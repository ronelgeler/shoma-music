'use client';
import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '@/lib/store';
import { getStreamUrl } from '@/lib/ibroadcast';
import { Play, Pause, SkipForward, SkipBack, Volume2, Shuffle } from 'lucide-react';

const formatTime = (val: number | string | undefined) => {
  let secs = Number(val) || 0;
  if (secs > 10000) secs = Math.floor(secs / 1000); // fallback for ms
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function Player() {
  const { currentTrack, isPlaying, setIsPlaying, playNext, playPrevious, toggleShuffle, isShuffle, token, userId } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

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
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const handleEnded = () => {
    playNext();
  };

  if (!currentTrack || !token || !userId) return null;

  const streamUrl = getStreamUrl(currentTrack.uid, currentTrack.track_url, token, userId);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 text-white z-50">
      <audio
        ref={audioRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
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
            <button 
              onClick={toggleShuffle} 
              className={`transition hover:scale-105 ${isShuffle ? 'text-green-500' : 'text-neutral-400 hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle size={18} />
            </button>
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
            <div className="w-[18px]" /> {/* Spacer for balance */}
          </div>
          
          <div className="flex items-center w-full max-w-md mt-2 gap-3 text-xs text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 cursor-pointer accent-white bg-neutral-700 rounded-full appearance-none"
              style={{ outline: 'none' }}
            />
            <span>{formatTime(duration || currentTrack.length)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end w-1/3 space-x-3 text-neutral-400">
          <Volume2 size={20} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
            className="w-24 h-1 cursor-pointer accent-white bg-neutral-700 rounded-full appearance-none"
            style={{ outline: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
