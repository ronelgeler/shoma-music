const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

async function test() {
  const query = "never gonna give you up";
  const r = await yts(query);
  const video = r.videos[0];
  console.log("Found:", video.title);
  
  const stream = ytdl(video.url, { filter: 'audioonly' });
  const chunks = [];
  
  stream.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  stream.on('end', async () => {
    const buffer = Buffer.concat(chunks);
    console.log("Downloaded", buffer.length, "bytes");
    // now we can use it as a Blob in FormData
  });
}
test();