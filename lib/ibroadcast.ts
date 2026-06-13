export async function loginToIBroadcast(email: string, password: string) {
  const url = "/api/login";
  const payload = {
    mode: "status",
    email_address: email,
    password: password,
    client: "shoma-music",
    version: "1.4"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (data.result === false) {
    throw new Error(data.message || "Login failed");
  }
  
  // Resiliently grab token and user ID
  const token = data.token || data.user?.token;
  const userId = data.user?.user_id || data.user?.id || data.userId;
  
  if (!token || !userId) {
    console.error("[SHOMA] Missing Auth Info in response:", data);
  }

  return { token, userId: String(userId) };
}

export async function fetchLibrary(token: string, userId: string) {
  const url = "/api/library";
  const payload = {
    mode: "library",
    user_id: userId,
    token: token,
    client: "shoma-music",
    version: "1.4"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return data;
}

export async function deleteTrack(trackId: string, token: string, userId: string) {
  const url = "/api/trash";
  const payload = {
    mode: "trashtracks",
    user_id: userId,
    token: token,
    tracks: [Number(trackId)],
    client: "shoma-music",
    version: "1.4"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return data;
}

export async function createPlaylist(name: string, token: string, userId: string) {
  const url = "/api/playlist";
  const payload = {
    mode: "createplaylist",
    name: name,
    tracks: [],
    user_id: userId,
    token: token,
    client: "shoma-music",
    version: "1.4"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function appendToPlaylist(playlistId: string, trackIds: string[], token: string, userId: string) {
  const url = "/api/playlist";
  const payload = {
    mode: "appendplaylist",
    playlist_id: playlistId,
    tracks: trackIds,
    user_id: userId,
    token: token,
    client: "shoma-music",
    version: "1.4"
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

import { Track } from './store';

export function getStreamUrl(track: Track, token: string, userId: string, ytCredentials?: any) {
  if (track.source === 'youtube' && track.ytId) {
    let url = `/api/yt-stream?id=${track.ytId}`;
    if (ytCredentials?.cookie) url += `&c=${encodeURIComponent(ytCredentials.cookie)}`;
    if (ytCredentials?.poToken) url += `&po=${encodeURIComponent(ytCredentials.poToken)}`;
    return url;
  }
  
  const trackId = track.file_id || track.uid;
  const trackUrl = track.track_url;

  if (trackUrl) {
    const cleanTrackUrl = trackUrl.startsWith('/') ? trackUrl : `/${trackUrl}`;
    return `https://streaming.ibroadcast.com${cleanTrackUrl}?Signature=${token}&file_id=${trackId}&user_id=${userId}&platform=shoma-music&version=1.4`;
  }
  return `https://streaming.ibroadcast.com/stream/${trackId}?user_id=${userId}&token=${token}&client=shoma-music&version=1.4`;
}
