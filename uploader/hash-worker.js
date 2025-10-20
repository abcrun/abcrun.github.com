/* eslint-disable no-restricted-globals */
import xxhash from 'xxhash-wasm';

function readFileChunk(chunk) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(chunk);
  });
}

async function calculateFileHash(hasher, file, size) {
  const metadata = `${file.name}-${file.size}-${file.lastModified}`;
  const streamHasher = hasher.create32(); // 使用32位版本，速度更快，对于文件标识足够用
  streamHasher.update(metadata);

  // 抽样区域：开头、中间、尾部
  const sampleOffsets = [
    0, // 开头
    Math.floor((file.size - size) / 2), // 中间
    Math.max(0, file.size - size), // 尾部
  ].filter((offset) => offset >= 0 && offset < file.size); // 过滤掉无效的偏移量 - 因为有些文件可能很小

  const chunkPromises = sampleOffsets.map((offset) => {
    const sampleSize = Math.min(size, file.size - offset);
    const chunk = file.slice(offset, offset + sampleSize);
    return readFileChunk(chunk);
  });

  const arrayBuffers = await Promise.all(chunkPromises);
  arrayBuffers.forEach((arrayBuffer) => {
    streamHasher.update(new Uint8Array(arrayBuffer));
  });

  const hash = streamHasher.digest().toString(16);

  return hash;
}

self.onmessage = async (event) => {
  const { file, size } = event.data;

  try {
    const hasher = await xxhash();
    const hash = await calculateFileHash(hasher, file, size);

    self.postMessage({ status: 'success', hash });
  } catch (error) {
    self.postMessage({ status: 'error', error: error.message });
  }
};
