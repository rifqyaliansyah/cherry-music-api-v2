// test-thumb.js
const { getThumbnail } = require('./src/utils/downloader');

async function test() {
    const url = 'https://youtu.be/tGv7CUutzqU';
    console.log('Testing thumbnail for:', url);

    const thumb = await getThumbnail(url);
    console.log('Result:', thumb);
}

test();