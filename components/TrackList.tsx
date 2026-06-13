'use client';
import { useState } from 'react';
import { Track, Playlist, usePlayerStore } from '@/lib/store';
import { Play, Trash2, PlusCircle, Clock } from 'lucide-react';

interface TrackListProps {
  tracks: Track[];
  onDelete?: (trackId: string) => void;
  onAddToPlaylist?: (trackId: string, playlistId: string) => void;
  onCreatePlaylistAndAdd?: (trackId: string, playlistName: string) => void;
}

const formatTime = (val: number | string | undefined) => {
  let secs = Number(val) || 0;
  if (secs > 10000) secs = Math.floor(secs / 1000); // handle ms if any
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function TrackList({ tracks, onDelete, onAddToPlaylist, onCreatePlaylistAndAdd }: TrackListProps) {
  const { currentTrack, setQueue, setQueueIndex, setIsPlaying, setCurrentTrack, playlists } = usePlayerStore();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handlePlay = (index: number) => {
    setQueue(tracks);
    setQueueIndex(index);
    setCurrentTrack(tracks[index]);
    setIsPlaying(true);
  };

  const handleAdd = (trackId: string, playlistId: string) => {
    onAddToPlaylist?.(trackId, playlistId);
    setActiveMenuId(null);
  };

  const handleCreateAndAdd = (trackId: string) => {
    if (!newPlaylistName.trim()) return;
    onCreatePlaylistAndAdd?.(trackId, newPlaylistName);
    setNewPlaylistName('');
    setActiveMenuId(null);
  };

  return (
    <div className="w-full text-left text-neutral-400 text-sm pb-10 overflow-x-hidden">
      <div className="min-w-full">
        <div className="grid grid-cols-[30px_1fr_80px] md:grid-cols-[40px_1fr_1fr_60px_80px] gap-4 md:gap-8 p-3 border-b border-neutral-800 font-medium items-center">
          <div>#</div>
          <div>Title</div>
          <div className="hidden md:block">Album</div>
          <div className="hidden md:flex items-center"><Clock size={14} className="text-neutral-500" /></div>
          <div className="text-right pr-2">Actions</div>
        </div>
        <div className="flex flex-col mt-2 space-y-1">
          {tracks.map((track, index) => {
            const isCurrent = currentTrack?.uid === track.uid;
            const showMenu = activeMenuId === track.uid;
            
            return (
              <div 
                key={track.uid} 
                className={`relative grid grid-cols-[30px_1fr_80px] md:grid-cols-[40px_1fr_1fr_60px_80px] gap-4 md:gap-8 p-3 rounded-md hover:bg-neutral-800/50 group transition items-center ${isCurrent ? 'bg-neutral-800/30 text-green-500' : ''}`}
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
                <div className="min-w-0">
                  <div className={`font-medium truncate ${isCurrent ? 'text-green-500' : 'text-white'}`}>{track.title}</div>
                  <div className="text-xs mt-0.5 truncate">{track.artist}</div>
                </div>
                <div className="hidden md:flex items-center truncate">{track.album || 'Unknown Album'}</div>
                <div className="hidden md:flex items-center text-xs text-neutral-500 whitespace-nowrap">{formatTime(track.length)}</div>
                <div className="flex items-center justify-end pr-1 gap-1 md:gap-2 whitespace-nowrap">
                <button 
                  onClick={() => setActiveMenuId(showMenu ? null : track.uid)}
                  className={`p-1.5 text-neutral-500 hover:text-white transition-colors ${showMenu ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100'}`}
                  title="Add to Playlist"
                >
                  <PlusCircle size={16} />
                </button>
                <button 
                  onClick={() => onDelete?.(track.uid)}
                  className="p-1.5 text-neutral-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete track"
                >
                  <Trash2 size={16} />
                </button>
                
                {showMenu && (
                  <div className="absolute right-10 top-10 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 p-2 text-white">
                    <div className="text-xs font-semibold text-neutral-500 mb-2 px-2 uppercase tracking-wider">Add to Playlist</div>
                    {playlists.length > 0 && (
                      <div className="max-h-40 overflow-y-auto mb-2 border-b border-neutral-800 pb-2">
                        {playlists.map(p => (
                          <button 
                            key={p.uid} 
                            onClick={() => handleAdd(track.uid, p.uid)}
                            className="w-full text-left px-2 py-1.5 text-sm hover:bg-neutral-800 rounded truncate"
                          >
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-1">
                      <input 
                        type="text" 
                        placeholder="New playlist..." 
                        value={newPlaylistName}
                        onChange={e => setNewPlaylistName(e.target.value)}
                        className="w-full bg-neutral-800 text-xs px-2 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-white"
                        onKeyDown={e => { if(e.key === 'Enter') handleCreateAndAdd(track.uid); }}
                      />
                      <button 
                        onClick={() => handleCreateAndAdd(track.uid)}
                        disabled={!newPlaylistName.trim()}
                        className="w-full bg-white text-black text-xs font-bold py-1.5 rounded disabled:opacity-50"
                      >
                        Create & Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
