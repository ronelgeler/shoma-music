'use client';
import { useState, useEffect, useMemo } from 'react';
import { loginToIBroadcast, fetchLibrary, deleteTrack, createPlaylist, appendToPlaylist } from '@/lib/ibroadcast';
import { usePlayerStore, Track } from '@/lib/store';
import TrackList from './TrackList';
import SearchBar from './SearchBar';
import { Loader2, DownloadCloud, Search, Music } from 'lucide-react';

export default function MusicLibrary() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const { setAuth, token, userId, playlists, setPlaylists } = usePlayerStore();
  
  const [downloadQuery, setDownloadQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isDownloading) {
      setDownloadProgress(0);
      interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 95) return prev;
          const step = Math.random() * 5;
          return Math.min(prev + step, 95);
        });
      }, 800);
    } else {
      setDownloadProgress(0);
    }
    return () => clearInterval(interval);
  }, [isDownloading]);

  const loadLibrary = async (currentToken: string, currentUserId: string) => {
    try {
      const libraryData = await fetchLibrary(currentToken, currentUserId);
      const parsedTracks: Track[] = [];
      const parsedPlaylists: any[] = [];
      
      // iBroadcast library data can be in .library.tracks or just .tracks or at the root
      const rawTracks = libraryData?.library?.tracks || libraryData?.tracks || libraryData;
      
      if (rawTracks && typeof rawTracks === 'object') {
        const trackMap = rawTracks.map || {};
        const titleIdx = trackMap['title'] ?? trackMap['name'] ?? trackMap['t'];
        const artistIdx = trackMap['artist'] ?? trackMap['artist_name'] ?? trackMap['a'];
        const albumIdx = trackMap['album'] ?? trackMap['album_name'] ?? trackMap['z'];
        const yearIdx = trackMap['year'] ?? trackMap['y'];
        const lengthIdx = trackMap['length'] ?? trackMap['l'];
        const fileIdIdx = trackMap['file_id'] ?? trackMap['fileid'] ?? trackMap['f'];
        const trackUrlIdx = trackMap['file'] ?? trackMap['path'] ?? trackMap['p'];

        const trackEntries = Array.isArray(rawTracks) 
          ? rawTracks.map(t => [t.id || t.uid || t.i, t])
          : Object.entries(rawTracks);

        for (const [uid, trackData] of trackEntries) {
          if (uid === 'map' || !trackData) continue;
          
          let title = 'Unknown Title';
          let artist = 'Unknown Artist';
          let album = 'Unknown Album';
          let year = '';
          let length = 0;
          let file_id = uid;
          let track_url = '';

          if (Array.isArray(trackData)) {
             title = titleIdx !== undefined ? trackData[titleIdx] : 'Unknown Title';
             artist = artistIdx !== undefined ? trackData[artistIdx] : 'Unknown Artist';
             album = albumIdx !== undefined ? trackData[albumIdx] : 'Unknown Album';
             year = yearIdx !== undefined ? trackData[yearIdx]?.toString() : '';
             length = lengthIdx !== undefined ? trackData[lengthIdx] : 0;
             file_id = fileIdIdx !== undefined ? String(trackData[fileIdIdx]) : uid;
             track_url = trackUrlIdx !== undefined ? trackData[trackUrlIdx] : '';
          } else if (typeof trackData === 'object') {
             const t = trackData as any;
             title = t.title || t.name || t.track_name || t.t || 'Unknown Title';
             artist = t.artist || t.artist_name || t.a || 'Unknown Artist';
             album = t.album || t.album_name || t.z || 'Unknown Album';
             year = (t.year || t.y)?.toString() || '';
             length = t.length || t.l || 0;
             file_id = String(t.file_id || t.fileid || t.f || uid);
             track_url = t.file || t.path || t.p || '';
          }

          parsedTracks.push({
            uid: String(uid),
            title,
            artist,
            album,
            year,
            length,
            file_id,
            track_url,
          });
        }
      }
      
      const rawPlaylists = libraryData?.library?.playlists || libraryData?.playlists || {};
      if (rawPlaylists && typeof rawPlaylists === 'object') {
        const entries = Array.isArray(rawPlaylists) 
          ? rawPlaylists.map((p, i) => [String(i), p]) 
          : Object.entries(rawPlaylists).filter(x => x[0] !== 'map');
          
        for (const [pid, pData] of entries) {
          if (!pData) continue;
          if (Array.isArray(pData)) {
             parsedPlaylists.push({
               uid: String(pid),
               name: pData[0] || 'Unknown Playlist',
               tracks: (pData[1] || []).map(String)
             });
          } else if (typeof pData === 'object') {
             const p = pData as any;
             parsedPlaylists.push({
               uid: String(p.uid || p.id || pid),
               name: p.name || 'Unknown Playlist',
               tracks: (p.tracks || []).map(String)
             });
          }
        }
      }

      setTracks(parsedTracks);
      setPlaylists(parsedPlaylists);
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

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadQuery.trim()) return;
    
    // If it's a URL, go straight to download
    if (downloadQuery.includes('http://') || downloadQuery.includes('https://')) {
      handleDownloadSelection(downloadQuery);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setDownloadMsg('');
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: downloadQuery })
      });
      const data = await res.json();
      if (res.ok && data.results) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setDownloadMsg('No results found.');
        }
      } else {
        setDownloadMsg('Error: ' + (data.error || 'Failed to search'));
      }
    } catch (err) {
      setDownloadMsg('Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadSelection = async (queryUrl: string) => {
    if (!token || !userId) return;
    
    setSearchResults([]); // Hide results
    setIsDownloading(true);
    setDownloadProgress(0); // Reset progress
    setDownloadMsg('Downloading and uploading to your library...');
    try {
      const currentTrackCount = tracks.length;
      
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryUrl, token, userId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDownloadMsg('Processing... waiting for song to appear in library.');
        
        let newCount = currentTrackCount;
        let attempts = 0;
        
        // Poll every 2 seconds for up to 30 seconds to see if the track count increased
        while (newCount <= currentTrackCount && attempts < 15) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const libData = await fetchLibrary(token, userId);
            const rawTracks = libData?.library?.tracks || libData?.tracks || libData;
            if (rawTracks) {
               const entries = Array.isArray(rawTracks) 
                 ? rawTracks 
                 : Object.entries(rawTracks).filter(x => x[0] !== 'map');
               newCount = entries.length;
            }
          } catch(e) {}
          attempts++;
        }
        
        await loadLibrary(token, userId);
        setDownloadProgress(100); // Complete!
        setDownloadMsg('Song added!');
        setDownloadQuery('');
        setTimeout(() => {
          setIsDownloading(false);
          setDownloadProgress(0);
        }, 3000); // Keep 100% for 3 seconds
      } else {
        setIsDownloading(false);
        setDownloadMsg('Error: ' + (data.error || 'Failed to process song'));
      }
    } catch (err) {
      setIsDownloading(false);
      setDownloadMsg('Download failed.');
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

  const handleAddToPlaylist = async (trackId: string, playlistId: string) => {
    if (!token || !userId) return;
    try {
      const playlist = playlists.find(p => p.uid === playlistId);
      const existingTracks = playlist?.tracks || [];
      if (existingTracks.includes(trackId)) {
        alert('Song is already in this playlist');
        return;
      }
      
      const newTracks = [...existingTracks, trackId];
      await appendToPlaylist(playlistId, newTracks, token, userId);
      await loadLibrary(token, userId);
      alert('Added to playlist!');
    } catch (err) {
      alert('Failed to add to playlist');
    }
  };

  const handleCreatePlaylistAndAdd = async (trackId: string, playlistName: string) => {
    if (!token || !userId) return;
    try {
      const data = await createPlaylist(playlistName, token, userId);
      const newPlaylistId = data.playlist_id || data.id;
      if (newPlaylistId) {
         await appendToPlaylist(String(newPlaylistId), [trackId], token, userId);
         await loadLibrary(token, userId);
         alert('Playlist created and song added!');
      } else {
         await loadLibrary(token, userId); // Reload just in case
      }
    } catch (err) {
      alert('Failed to create playlist');
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
      <div className="flex flex-col md:flex-row md:items-start justify-between mb-8 gap-4">
        <div className="flex-1 mt-auto">
          <h1 className="text-4xl font-bold text-white mb-4">Your Library</h1>
          <SearchBar value={search} onChange={setSearch} />
        </div>
        
        <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 w-full md:w-96 shadow-lg md:mt-0 relative">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <DownloadCloud size={16} className="text-neutral-400" /> Search & Add Song
          </h3>
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Type song name (e.g. 'hello')"
              className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-white text-sm focus:outline-none focus:border-white"
              value={downloadQuery}
              onChange={e => setDownloadQuery(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={isSearching || isDownloading}
              className="bg-white text-black px-4 py-2 rounded-md font-medium text-sm flex items-center justify-center disabled:opacity-70 min-w-[80px] hover:scale-105 transition-transform"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </form>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
              <div className="p-2 space-y-1">
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    onClick={() => handleDownloadSelection(res.url)}
                    className="w-full text-left flex items-center gap-3 p-2 hover:bg-neutral-800 rounded-lg transition-colors group"
                  >
                    <div className="w-10 h-10 bg-neutral-800 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {res.artwork ? (
                        <img src={res.artwork} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                      ) : (
                        <Music size={16} className="text-neutral-500" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium text-white truncate">{res.title}</p>
                      <p className="text-xs text-neutral-400 truncate">{res.artist}</p>
                    </div>
                    <span className="text-xs text-neutral-500 pr-2">{res.duration}</span>
                    <DownloadCloud size={16} className="text-neutral-500 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {isDownloading && (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-neutral-500 mb-1 px-1 uppercase font-bold tracking-wider">
                <span>{downloadProgress >= 100 ? 'Success' : 'Downloading & Processing'}</span>
                <span>{Math.round(downloadProgress)}%</span>
              </div>
              <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/50">
                <div 
                  className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_12px_rgba(255,255,255,0.4)]" 
                  style={{ width: `${downloadProgress}%` }} 
                />
              </div>
            </div>
          )}
          {downloadMsg && !isDownloading && downloadProgress === 0 && <p className="text-xs mt-2 text-neutral-400 italic">{downloadMsg}</p>}
          {downloadMsg && downloadProgress >= 100 && <p className="text-xs mt-2 text-green-400 font-medium">{downloadMsg}</p>}
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-neutral-400 text-center mt-12 py-20 border-2 border-dashed border-neutral-800 rounded-2xl">
          <p className="text-lg mb-2">No tracks found.</p>
          <p className="text-sm">Type a song name above to start your collection!</p>
        </div>
      ) : (
        <TrackList 
          tracks={filteredTracks} 
          onDelete={handleDeleteTrack} 
          onAddToPlaylist={handleAddToPlaylist}
          onCreatePlaylistAndAdd={handleCreatePlaylistAndAdd}
        />
      )}
    </div>
  );
}
