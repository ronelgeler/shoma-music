'use client';
import { useState, useEffect, useMemo } from 'react';
import { loginToIBroadcast, fetchLibrary, deleteTrack, createPlaylist, appendToPlaylist } from '@/lib/ibroadcast';
import { usePlayerStore, Track, Playlist } from '@/lib/store';
import TrackList from './TrackList';
import SearchBar from './SearchBar';
import { Loader2, DownloadCloud, Search, Music, Home, ListMusic, Plus, Settings, X, Trash2, ShieldCheck, Play } from 'lucide-react';

export default function MusicLibrary() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const { setAuth, token, userId, playlists, setPlaylists, ytCredentials, setYtCredentials } = usePlayerStore();
  
  const [downloadQuery, setDownloadQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [uploadingUids, setUploadingUids] = useState<string[]>([]);

  const { setCurrentTrack, setIsPlaying, setQueue, setQueueIndex } = usePlayerStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cookieInput, setCookieInput] = useState('');
  const [poTokenInput, setPoTokenInput] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authData, setAuthData] = useState<{ code: string, url: string } | null>(null);

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleYouTubePlay = async (result: any) => {
    if (!token || !userId) return;

    // 1. Immediate Playback
    const ytTrack: Track = {
        uid: result.uid,
        ytId: result.ytId,
        title: result.title,
        artist: result.artist,
        album: 'YouTube',
        artwork: result.artwork,
        source: 'youtube',
        length: 0
    };

    setQueue([ytTrack]);
    setQueueIndex(0);
    setCurrentTrack(ytTrack);
    setIsPlaying(true);
    setSearchResults([]);

    // 2. Background Download/Upload
    if (uploadingUids.includes(result.uid)) return;
    
    setUploadingUids(prev => [...prev, result.uid]);
    setDownloadMsg(`Adding "${result.title}" to library in background...`);
    
    try {
        const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: result.url, 
                token, 
                userId,
                youtubeCookie: ytCredentials?.cookie,
                poToken: ytCredentials?.poToken,
                youtubeTokens: ytCredentials?.tokens
            })
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            // Wait for it to appear
            let attempts = 0;
            let found = false;
            while (attempts < 15 && !found) {
                await new Promise(r => setTimeout(r, 3000));
                const libData = await fetchLibrary(token, userId);
                const rawTracks = libData?.library?.tracks || libData?.tracks || libData;
                const trackList = Array.isArray(rawTracks) ? rawTracks : Object.values(rawTracks);
                
                // Try to find by title/artist since UID will change
                found = trackList.some((t: any) => {
                    const tTitle = t.title || t.name || t.t;
                    const tArtist = t.artist || t.artist_name || t.a;
                    return tTitle === data.title && tArtist === data.artist;
                });
                attempts++;
            }
            await loadLibrary(token, userId);
        }
    } catch (err) {
        console.error("[SHOMA] Background upload failed:", err);
    } finally {
        setUploadingUids(prev => prev.filter(uid => uid !== result.uid));
    }
  };

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

  useEffect(() => {
    if (ytCredentials) {
        setCookieInput(ytCredentials.cookie || '');
        setPoTokenInput(ytCredentials.poToken || '');
    }
  }, [ytCredentials]);

  const loadLibrary = async (currentToken: string, currentUserId: string) => {
    try {
      const libraryData = await fetchLibrary(currentToken, currentUserId);
      const parsedTracks: Track[] = [];
      const parsedPlaylists: any[] = [];
      
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

  const startYoutubeAuth = async () => {
    setIsAuthenticating(true);
    setAuthData(null);
    
    const eventSource = new EventSource('/api/youtube/auth');
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'code') {
            setAuthData({ code: data.code, url: data.url });
        } else if (data.type === 'tokens') {
            setYtCredentials({ ...ytCredentials, tokens: data.credentials });
            setIsAuthenticating(false);
            setAuthData(null);
            eventSource.close();
            alert('YouTube Login Successful!');
        } else if (data.type === 'error') {
            alert('Auth Error: ' + data.message);
            setIsAuthenticating(false);
            eventSource.close();
        }
    };

    eventSource.onerror = () => {
        setIsAuthenticating(false);
        eventSource.close();
    };
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadQuery.trim()) return;
    
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
    
    setSearchResults([]);
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadMsg('Downloading and uploading to your library...');
    try {
      const currentTrackCount = tracks.length;
      
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            query: queryUrl, 
            token, 
            userId,
            youtubeCookie: ytCredentials?.cookie,
            poToken: ytCredentials?.poToken,
            youtubeTokens: ytCredentials?.tokens
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDownloadMsg('Processing... waiting for song to appear in library.');
        
        let newCount = currentTrackCount;
        let attempts = 0;
        
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
        setDownloadProgress(100);
        setDownloadMsg('Song added!');
        setDownloadQuery('');
        setTimeout(() => {
          setIsDownloading(false);
          setDownloadProgress(0);
        }, 3000);
      } else {
        setIsDownloading(false);
        setDownloadMsg('Error: ' + (data.error || 'Failed to process song'));
      }
    } catch (err) {
      setIsDownloading(false);
      setDownloadMsg('Download failed.');
    }
  };

  const handleSaveCredentials = () => {
    setYtCredentials({ ...ytCredentials, cookie: cookieInput, poToken: poTokenInput });
    setIsSettingsOpen(false);
  };

  const handleClearCredentials = () => {
    if(confirm('Are you sure you want to clear all YouTube credentials?')) {
        setYtCredentials(null);
        setCookieInput('');
        setPoTokenInput('');
        setIsSettingsOpen(false);
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
         await loadLibrary(token, userId);
      }
    } catch (err) {
      alert('Failed to create playlist');
    }
  };

  const handleCreateEmptyPlaylist = async () => {
    if (!token || !userId || !newPlaylistName.trim()) return;
    try {
      await createPlaylist(newPlaylistName, token, userId);
      await loadLibrary(token, userId);
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
    } catch (err) {
      alert('Failed to create playlist');
    }
  };

  const filteredTracks = useMemo(() => {
    let sourceTracks = tracks;
    if (activePlaylistId) {
      const p = playlists.find(p => p.uid === activePlaylistId);
      if (p) {
        sourceTracks = p.tracks.map(tId => tracks.find(t => t.uid === tId)).filter(Boolean) as Track[];
      } else {
        sourceTracks = [];
      }
    }

    if (!search) return sourceTracks;
    const lower = search.toLowerCase();
    return sourceTracks.filter(t => 
      t.title.toLowerCase().includes(lower) || 
      t.artist.toLowerCase().includes(lower) || 
      t.album.toLowerCase().includes(lower)
    );
  }, [tracks, search, activePlaylistId, playlists]);

  const activePlaylistName = activePlaylistId 
    ? playlists.find(p => p.uid === activePlaylistId)?.name || 'Playlist'
    : 'All Tracks';

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
    <div className="flex flex-col md:flex-row min-h-screen -mx-4 md:-mx-8 -mt-16 pt-16 pb-32 overflow-x-hidden">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-black p-4 md:p-6 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col shrink-0">
        <div className="space-y-2 mb-4 md:mb-8">
          <button 
            onClick={() => setActivePlaylistId(null)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-md transition font-medium ${!activePlaylistId ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
          >
            <Home size={20} /> All Tracks
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between text-neutral-400 px-4 mb-2 md:mb-4">
            <span className="text-[10px] md:text-xs uppercase font-bold tracking-wider">Playlists</span>
            <button 
              onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
              className="hover:text-white transition"
              title="Create Playlist"
            >
              <Plus size={16} />
            </button>
          </div>

          {isCreatingPlaylist && (
            <div className="px-4 mb-4">
              <input 
                autoFocus
                type="text"
                placeholder="Playlist name..."
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') handleCreateEmptyPlaylist(); }}
                className="w-full bg-neutral-800 text-white text-sm px-3 py-2 rounded border border-neutral-700 focus:outline-none focus:border-white mb-2"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleCreateEmptyPlaylist}
                  disabled={!newPlaylistName.trim()}
                  className="bg-white text-black text-xs font-bold py-1.5 px-3 rounded disabled:opacity-50 flex-1"
                >
                  Create
                </button>
                <button 
                  onClick={() => setIsCreatingPlaylist(false)}
                  className="bg-neutral-800 text-white text-xs font-bold py-1.5 px-3 rounded flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 scrollbar-hide">
            {playlists.map(p => (
              <button
                key={p.uid}
                onClick={() => setActivePlaylistId(p.uid)}
                className={`flex-shrink-0 md:w-full text-left px-4 py-2 text-xs md:text-sm rounded-md transition whitespace-nowrap flex items-center gap-2 md:gap-3 ${activePlaylistId === p.uid ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
              >
                <ListMusic size={16} className="shrink-0" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between mb-8 gap-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-6xl font-bold text-white mb-6 tracking-tight truncate">{activePlaylistName}</h1>
            <SearchBar value={search} onChange={setSearch} />
          </div>
          
          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 w-full xl:w-96 shadow-lg relative shrink-0">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <DownloadCloud size={16} className="text-neutral-400" /> Search & Add Song
                </h3>
                <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="text-neutral-500 hover:text-white transition"
                    title="YouTube Settings"
                >
                    <Settings size={16} />
                </button>
            </div>

            {isSettingsOpen ? (
                <div className="space-y-4 bg-black/40 p-4 rounded-lg border border-neutral-800 mb-4 animate-in fade-in slide-in-from-top-1">
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">YouTube Authentication</span>
                        <div className="flex items-center gap-2">
                            <button onClick={handleClearCredentials} className="text-red-500 hover:text-red-400" title="Clear All"><Trash2 size={16} /></button>
                            <button onClick={() => setIsSettingsOpen(false)} className="text-neutral-500 hover:text-white"><X size={16} /></button>
                        </div>
                    </div>

                    <div className="space-y-3 pb-3 border-b border-neutral-800">
                        <p className="text-[10px] text-neutral-500 font-medium">BEST WAY: Official Login (Permanent-ish)</p>
                        {isAuthenticating ? (
                            <div className="bg-neutral-800 p-3 rounded text-center space-y-2">
                                {authData ? (
                                    <>
                                        <p className="text-[10px] text-neutral-400 leading-tight">Go to <a href={authData.url} target="_blank" className="text-white underline break-all">{authData.url}</a> and enter:</p>
                                        <p className="text-2xl font-mono font-bold tracking-widest text-white py-1">{authData.code}</p>
                                        <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-500">
                                            <Loader2 className="animate-spin" size={12} /> Waiting for confirmation...
                                        </div>
                                    </>
                                ) : (
                                    <div className="py-4">
                                        <Loader2 className="animate-spin mx-auto text-white" size={24} />
                                        <p className="text-[10px] text-neutral-500 mt-2">Connecting to Google...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button 
                                onClick={startYoutubeAuth}
                                className="w-full bg-red-600 text-white text-xs font-bold py-3 rounded-md flex items-center justify-center gap-2 hover:bg-red-700 transition active:scale-95"
                            >
                                <Music size={14} /> {ytCredentials?.tokens ? 'Re-login to YouTube' : 'Login to YouTube'}
                            </button>
                        )}
                        {ytCredentials?.tokens && !isAuthenticating && (
                            <div className="flex items-center justify-center gap-1.5 text-[10px] text-green-500 font-bold uppercase tracking-wider">
                                <ShieldCheck size={14} /> Logged in via OAuth
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-tight">Fallback: Manual Tokens</p>
                        <div className="space-y-1">
                            <label className="text-[10px] text-neutral-500 uppercase font-bold">Cookies (JSON/Netscape)</label>
                            <textarea 
                                className="w-full h-16 bg-neutral-800 border border-neutral-700 rounded p-2 text-[10px] text-white focus:outline-none focus:border-white font-mono"
                                placeholder="Paste cookies here..."
                                value={cookieInput}
                                onChange={e => setCookieInput(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] text-neutral-500 uppercase font-bold">PO Token (Bot Bypass)</label>
                            <input 
                                type="text"
                                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-white font-mono"
                                placeholder="Paste PO Token here..."
                                value={poTokenInput}
                                onChange={e => setPoTokenInput(e.target.value)}
                            />
                            <p className="text-[9px] text-neutral-600 mt-1">Generate at <a href="https://po-token.pages.dev/" target="_blank" className="underline hover:text-neutral-400 transition">po-token.pages.dev</a></p>
                        </div>
                    </div>

                    <button 
                        onClick={handleSaveCredentials}
                        className="w-full bg-white text-black text-xs font-bold py-3 rounded-full mt-2 hover:scale-[1.02] transition-transform active:scale-95 shadow-lg"
                    >
                        Save Manual Changes
                    </button>
                </div>
            ) : (
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
            )}

            {searchResults.length > 0 && !isSettingsOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                <div className="p-2 space-y-1">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => handleYouTubePlay(res)}
                      className="w-full text-left flex items-center gap-3 p-2 hover:bg-neutral-800 rounded-lg transition-colors group"
                    >
                      <div className="w-10 h-10 bg-neutral-800 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {res.artwork ? (
                          <img src={res.artwork} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                        ) : (
                          <Music size={16} className="text-neutral-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{res.title}</p>
                        <p className="text-xs text-neutral-400 truncate">{res.artist}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-neutral-500 pr-2 shrink-0">{res.duration}</span>
                        {uploadingUids.includes(res.uid) ? (
                            <Loader2 size={12} className="animate-spin text-white mr-2" />
                        ) : (
                            <Play size={12} className="text-neutral-500 group-hover:text-white mr-2" fill="currentColor" />
                        )}
                      </div>
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
            {downloadMsg && !isDownloading && downloadProgress === 0 && <p className="text-xs mt-2 text-neutral-400 italic leading-snug">{downloadMsg}</p>}
            {downloadMsg && downloadProgress >= 100 && <p className="text-xs mt-2 text-green-400 font-medium leading-snug">{downloadMsg}</p>}
          </div>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="text-neutral-400 text-center mt-12 py-20 border-2 border-dashed border-neutral-800 rounded-2xl flex flex-col items-center">
            <p className="text-lg mb-2">{search ? 'No tracks match your search.' : (activePlaylistId ? 'This playlist is empty.' : 'No tracks found.')}</p>
            {search && (
                <button 
                    onClick={() => {
                        setDownloadQuery(search);
                        handleSearchSubmit(new Event('submit') as any);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-4 flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-3 rounded-full transition-all border border-neutral-700 hover:border-neutral-500"
                >
                    <Search size={18} /> Search YouTube for "{search}"
                </button>
            )}
            {!search && <p className="text-sm">Type a song name above to start your collection!</p>}
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
    </div>
  );
}
