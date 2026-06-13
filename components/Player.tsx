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
  const { currentTrack, isPlaying, setIsPlaying, playNext, playPrevious, toggleShuffle, isShuffle, token, userId, ytCredentials } = usePlayerStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playStatus, setPlayStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [lastError, setLastError] = useState('');
  
  const [availableLinks, setAvailableLinks] = useState<{ url: string, source: string }[]>([]);
  const [linkIndex, setLinkIndex] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle Play/Pause
  useEffect(() => {
    if (audioRef.current && isPlaying && playStatus !== 'error') {
        audioRef.current.play().catch(e => {
            console.error("[SHOMA] Playback failed:", e);
            if (playStatus !== 'loading') setPlayStatus('error');
        });
    } else if (audioRef.current) {
        audioRef.current.pause();
    }
  }, [isPlaying]);

  // Fetch links and start rotation when track changes
  useEffect(() => {
    if (!currentTrack) return;
    
    setAvailableLinks([]);
    setLinkIndex(0);
    setPlayStatus('loading');
    setLastError('');

    if (currentTrack.source === 'youtube' && currentTrack.ytId) {
        const videoId = currentTrack.ytId;
        
        fetch(`/api/yt-stream?id=${videoId}`)
            .then(res => res.json())
            .then(data => {
                if (data.links && data.links.length > 0) {
                    setAvailableLinks(data.links);
                    setLinkIndex(0);
                } else {
                    throw new Error(data.error || 'No paths found');
                }
            })
            .catch(err => {
                setLastError(err.message);
                setPlayStatus('error');
            });
    } else {
        const streamUrl = getStreamUrl(currentTrack, token!, userId!, ytCredentials);
        setAvailableLinks([{ url: streamUrl, source: 'iBroadcast' }]);
        setLinkIndex(0);
    }
  }, [currentTrack?.uid, currentTrack?.ytId]);

  // Auto-load when links are ready or rotation happens
  useEffect(() => {
    if (audioRef.current && availableLinks.length > 0) {
        audioRef.current.load();
        if (isPlaying) {
            audioRef.current.play().catch(() => {
                // If it fails immediately, onError will handle rotation
            });
        }
    }
  }, [availableLinks, linkIndex]);

  const handleAudioError = () => {
    console.warn(`[SHOMA] Link ${linkIndex} failed (${availableLinks[linkIndex]?.source})`);
    if (linkIndex < availableLinks.length - 1) {
        setLinkIndex(prev => prev + 1);
        setPlayStatus('loading');
    } else {
        setLastError("All sources failed");
        setPlayStatus('error');
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
      if (playStatus === 'loading' && audioRef.current.currentTime > 0) {
        setPlayStatus('playing');
      }
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

  const currentLink = availableLinks[linkIndex];
  const streamUrl = currentLink ? currentLink.url : '';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 p-4 pb-6 md:pb-4 text-white z-50">
      <audio
        ref={audioRef}
        src={streamUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
        autoPlay={isPlaying}
        onError={handleAudioError}
      />
      <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-1/3 space-x-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-neutral-800 rounded flex items-center justify-center shrink-0 overflow-hidden">
              {currentTrack.artwork ? (
                <img src={currentTrack.artwork} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-neutral-500 text-[10px] md:text-xs text-center whitespace-nowrap">No Cover</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{currentTrack.title}</div>
              <div className="text-neutral-400 text-xs truncate flex items-center gap-2">
                {currentTrack.artist}
                {playStatus === 'loading' && (
                    <span className="text-blue-400 animate-pulse text-[10px] font-bold uppercase tracking-wider">
                        • {currentLink ? `Connecting ${currentLink.source}...` : 'Fetching Links...'}
                    </span>
                )}
                {playStatus === 'playing' && (
                    <span className="text-green-500 text-[10px] font-bold uppercase tracking-wider">
                        • Streaming ({currentLink?.source || 'Direct'})
                    </span>
                )}
                {playStatus === 'error' && (
                    <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider" title={lastError}>
                        • Error: {lastError.length > 20 ? 'No links worked' : lastError}
                    </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex md:hidden items-center space-x-3 shrink-0">
            <button onClick={playPrevious} className="text-neutral-400 hover:text-white transition">
              <SkipBack size={18} />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition shrink-0 shadow-lg"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button onClick={playNext} className="text-neutral-400 hover:text-white transition">
              <SkipForward size={18} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center w-full md:w-1/3 mt-1 md:mt-0">
          <div className="hidden md:flex items-center space-x-6">
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
            <div className="w-[18px]" />
          </div>
          
          <div className="flex items-center w-full max-w-md gap-3 text-xs text-neutral-400">
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

        <div className="hidden md:flex items-center justify-end w-1/3 space-x-3 text-neutral-400">
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
