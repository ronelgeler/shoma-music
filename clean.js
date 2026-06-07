const axios = require('axios');

async function listTracks() {
  try {
    const email = 'ronelgeler@gmail.com';
    const password = '1234';

    const loginRes = await axios.post('https://api.ibroadcast.com/s/JSON/status', {
      mode: 'status',
      email_address: email,
      password: password,
      client: 'web'
    });

    const token = loginRes.data.user.token;
    const userId = loginRes.data.user.id;

    const libRes = await axios.post('https://library.ibroadcast.com', {
      mode: 'library',
      user_id: userId,
      token: token
    });

    const tracks = libRes.data.library.tracks || {};
    let toDelete = [];
    
    for (const [uid, track] of Object.entries(tracks)) {
      if (uid === 'map') continue; // ignore the internal map object
      const title = String(track.title || '');
      const artist = String(track.artist || '');
      console.log(`- "${title}" by "${artist}" (UID: ${uid})`);
      if (title.toLowerCase().includes('unknown') || artist.toLowerCase().includes('unknown') || !title || !artist || title === 'undefined') {
          toDelete.push(uid);
      }
    }
    
    if(toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} tracks...`);
        const delRes = await axios.post('https://api.ibroadcast.com/s/JSON/status', {
            mode: 'trash',
            user_id: userId,
            token: token,
            tracks: toDelete
        });
        console.log('Delete done', delRes.data.message);
    }
  } catch (err) {
    console.error(err);
  }
}

listTracks();