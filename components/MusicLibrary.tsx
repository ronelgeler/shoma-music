'use client';
import { useState, useEffect, useMemo } from 'react';
import { loginToIBroadcast, fetchLibrary, deleteTrack } from '@/lib/ibroadcast';
import { usePlayerStore, Track } from '@/lib/store';
import TrackList from './TrackList';
import SearchBar from './SearchBar';
import { Loader2, DownloadCloud } from 'lucide-react';

export default function MusicLibrary() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const { setAuth, token, userId } = usePlayerStore();
  const [downloadQuery, setDownloadQuery] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');

  const loadLibrary = async (currentToken: string, currentUserId: string) => {
    try {
      const libraryData = await fetchLibrary(currentToken, currentUserId);
      const parsedTracks: Track[] = [];
      if (libraryData && libraryData.tracks) {
        for (const [uid, trackData] of Object.entries(libraryData.tracks)) {
          if (uid === 'map') continue;
          const t = trackData as any;
          parsedTracks.push({
            uid,
            title: t.title || 'Unknown Title',
            artist: t.artist || 'Unknown Artist',
            album: t.album || 'Unknown Album',
            year: t.year?.toString() || '',
            length: t.length || 0,
          });
        }
      }
      setTracks(parsedTracks);
    } catch (err) {
      console.error("Failed to load library:", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token: newToken, userId: newUserId } = await loginToIBroadcast(email, password);
      setAuth(newToken, newUserId);
      await loadLibrary(newToken, newUserId);
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadQuery || !token || !userId) return;
    
    setIsDownloading(true);
    setDownloadMsg('Downloading and uploading to your library...');
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: downloadQuery, token, userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDownloadMsg('Song added! It may take a minute to appear.');
        setDownloadQuery('');
        // Wait a bit and refresh
        setTimeout(() => loadLibrary(token, userId), 2000);
      } else {
        setDownloadMsg('Error: ' + (data.error || 'Failed to process song'));
      }
    } catch (err) {
      setDownloadMsg('Download failed.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!token || !userId) return;
    if (!confirm('Are you sure you want to delete this track?')) return;

    try {
      await deleteTrack(trackId, token, userId);
      setTracks(tracks.filter(t => t.uid !== trackId));
    } catch (err) {
      alert('Failed to delete track');
    }
  };

  const filteredTracks = useMemo(() => {
    if (!search) return tracks;
    const lower = search.toLowerCase();
    return tracks.filter(t => 
      t.title.toLowerCase().includes(lower) || 
      t.artist.toLowerCase().includes(lower) || 
      t.album.toLowerCase().includes(lower)
    );
  }, [tracks, search]);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-full max-w-md p-8 bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">Log In</h2>
          <p className="text-neutral-400 text-center mb-8">Access your iBroadcast library</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-3 rounded-full hover:scale-[1.02] transition-transform flex items-center justify-center disabled:opacity-70 disabled:hover:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-white mb-4">Your Library</h1>
          <SearchBar value={search} onChange={setSearch} />
        </div>
        
        <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 w-full md:w-96 shadow-lg">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <DownloadCloud size={16} className="text-neutral-400" /> Add new song
          </h3>
          <form onSubmit={handleDownload} className="flex gap-2">
            <input
              type="text"
              placeholder="Song name or YouTube URL"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm focus:outline-none focus:border-white"
              value={downloadQuery}
              onChange={e => setDownloadQuery(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={isDownloading}
              className="bg-white text-black px-4 py-2 rounded-md font-medium text-sm flex items-center justify-center disabled:opacity-70 min-w-[80px] hover:scale-105 transition-transform"
            >
              {isDownloading ? <Loader2 size={16} className="animate-spin" /> : 'Get'}
            </button>
          </form>
          {downloadMsg && <p className="text-xs mt-2 text-neutral-400 italic">{downloadMsg}</p>}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-neutral-400 text-center mt-12 py-20 border-2 border-dashed border-neutral-800 rounded-2xl">
          <p className="text-lg mb-2">No tracks found.</p>
          <p className="text-sm">Type a song name above to start your collection!</p>
        </div>
      ) : (
        <TrackList tracks={filteredTracks} onDelete={handleDeleteTrack} />
      )}
    </div>
  );
}
