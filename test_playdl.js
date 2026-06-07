const play = require('play-dl');

async function test() {
  try {
    const query = "never gonna give you up";
    console.log("Searching...");
    const searchResults = await play.search(query, { limit: 1 });
    const video = searchResults[0];
    console.log("Found:", video.title);
    
    console.log("Getting stream...");
    const stream = await play.stream(video.url);
    console.log("Stream obtained:", stream.type);
    
    const chunks = [];
    stream.stream.on('data', chunk => chunks.push(chunk));
    stream.stream.on('end', () => {
      const buf = Buffer.concat(chunks);
      console.log("Downloaded", buf.length, "bytes");
    });
  } catch (e) {
    console.error(e);
  }
}
test();