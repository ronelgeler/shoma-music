'use client';
import { Track, usePlayerStore } from '@/lib/store';
import { Play } from 'lucide-react';

interface TrackListProps {
  tracks: Track[];
}

export default function TrackList({ tracks }: TrackListProps) {
  const { currentTrack, setQueue, setQueueIndex, setIsPlaying, setCurrentTrack } = usePlayerStore();

  const handlePlay = (index: number) => {
    setQueue(tracks);
    setQueueIndex(index);
    setCurrentTrack(tracks[index]);
    setIsPlaying(true);
  };

  return (
    <div className="w-full text-left text-neutral-400 text-sm">
      <div className="grid grid-cols-[40px_1fr_1fr_auto] gap-4 p-3 border-b border-neutral-800 font-medium">
        <div>#</div>
        <div>Title</div>
        <div>Album</div>
        <div>Year</div>
      </div>
      <div className="flex flex-col mt-2 space-y-1">
        {tracks.map((track, index) => {
          const isCurrent = currentTrack?.uid === track.uid;
          return (
            <div 
              key={track.uid} 
              className={`grid grid-cols-[40px_1fr_1fr_auto] gap-4 p-3 rounded-md hover:bg-neutral-800/50 group transition ${isCurrent ? 'bg-neutral-800/30 text-green-500' : ''}`}
            >
              <div className="flex items-center">
                <span className="group-hover:hidden">{index + 1}</span>
                <button 
                  onClick={() => handlePlay(index)}
                  className="hidden group-hover:flex text-white"
                >
                  <Play size={16} fill="currentColor" />
                </button>
              </div>
              <div>
                <div className={`font-medium ${isCurrent ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
                <div className="text-xs mt-0.5">{track.artist}</div>
              </div>
              <div className="flex items-center">{track.album || 'Unknown Album'}</div>
              <div className="flex items-center">{track.year || '-'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
