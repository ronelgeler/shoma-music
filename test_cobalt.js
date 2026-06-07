const queryUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

async function testCobalt() {
  try {
    const res = await fetch("https://api.cobalt.tools/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: queryUrl,
        isAudioOnly: true,
        aFormat: "mp3"
      })
    });
    
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
testCobalt();