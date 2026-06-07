export async function loginToIBroadcast(email: string, password: string) {
  const url = "/api/login";
  const payload = {
    mode: "status",
    email_address: email,
    password: password,
    client: "web",
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
    throw new Error("Login failed");
  }
  return {
    token: data.user?.token,
    userId: data.user?.id,
  };
}

export async function fetchLibrary(token: string, userId: string) {
  const url = "/api/library";
  const payload = {
    mode: "library",
    user_id: userId,
    token: token,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  return data.library;
}

export async function deleteTrack(trackId: string, token: string, userId: string) {
  const url = "/api/trash";
  const payload = {
    user_id: userId,
    token: token,
    tracks: [trackId],
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

export function getStreamUrl(trackId: string, token: string, userId: string) {
  return `https://streaming.ibroadcast.com/stream/${trackId}?user_id=${userId}&token=${token}`;
}
