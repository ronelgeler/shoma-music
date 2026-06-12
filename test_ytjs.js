const { Innertube } = require('youtubei.js');

async function test() {
  try {
    const yt = await Innertube.create();
    console.log('Session created');
    const stream = await yt.download('YQHsXMglC9A', { type: 'audio', quality: 'best', format: 'mp4', client: 'ANDROID_VR' });
    console.log('Stream obtained');
    let size = 0;
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
    }
    console.log('Downloaded', size, 'bytes');
  } catch (e) {
    console.error(e);
  }
}

test();
