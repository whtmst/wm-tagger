export function parseRiffChunks(buffer) {
  if (buffer.byteLength < 12) throw new Error("Файл слишком мал для WAV");
  const view = new DataView(buffer);
  const riffId = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const waveId = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (riffId !== 'RIFF' || waveId !== 'WAVE') throw new Error("Это не корректный WAV файл");

  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.byteLength) {
    const id = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const size = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    if (dataStart + size > buffer.byteLength) break;
    chunks.push({ id, size, dataStart, headerStart: offset });
    offset = dataStart + size + (size % 2);
  }
  return chunks;
}

export function parseListInfo(buffer, chunk) {
  const info = {};
  if (chunk.size < 4) return info;
  const view = new DataView(buffer, chunk.dataStart + 4, chunk.size - 4);
  let offset = 0;
  const decoder = new TextDecoder("utf-8");
  while (offset + 8 <= view.byteLength) {
    const subId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
    const subSize = view.getUint32(offset + 4, true);
    if (offset + 8 + subSize > view.byteLength) break;
    const bytes = new Uint8Array(buffer, chunk.dataStart + 4 + offset + 8, subSize);
    const str = decoder.decode(bytes).replace(/\0/g, '').trim();
    if (subId === 'INAM') info.title = str;
    if (subId === 'IART') info.artist = str;
    if (subId === 'IGNR') info.genre = str;
    if (subId === 'ICRD') info.year = str;
    offset += 8 + subSize + (subSize % 2);
  }
  return info;
}

export function extractId3FromWav(buffer) {
  const chunks = parseRiffChunks(buffer);
  const id3chunk = chunks.find(c => c.id.toLowerCase() === 'id3 ');
  if (!id3chunk) return null;
  return buffer.slice(id3chunk.dataStart, id3chunk.dataStart + id3chunk.size);
}

export function injectId3IntoWav(originalBuffer, id3TagBytes) {
  const chunks = parseRiffChunks(originalBuffer).filter(c => {
    if (c.id.toLowerCase() === 'id3 ') return false;
    if (c.id === 'LIST') {
      const view = new DataView(originalBuffer, c.dataStart, 4);
      const type = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (type === 'INFO') return false;
    }
    return true;
  });

  const parts = [];
  for (const c of chunks) {
    const paddedSize = c.size + (c.size % 2);
    parts.push(originalBuffer.slice(c.headerStart, c.headerStart + 8 + paddedSize));
  }

  const id3Size = id3TagBytes.byteLength;
  const id3Padding = id3Size % 2;
  const id3ChunkHeader = new Uint8Array(8);
  id3ChunkHeader.set([0x69, 0x64, 0x33, 0x20], 0);
  new DataView(id3ChunkHeader.buffer).setUint32(4, id3Size, true);

  const id3ChunkBytes = new Uint8Array(8 + id3Size + id3Padding);
  id3ChunkBytes.set(id3ChunkHeader, 0);
  id3ChunkBytes.set(new Uint8Array(id3TagBytes), 8);
  parts.push(id3ChunkBytes.buffer);

  const totalDataSize = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const riffSize = 4 + totalDataSize;

  const out = new Uint8Array(8 + riffSize);
  out.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(out.buffer).setUint32(4, riffSize, true);
  out.set([0x57, 0x41, 0x56, 0x45], 8);

  let pos = 12;
  for (const p of parts) {
    out.set(new Uint8Array(p), pos);
    pos += p.byteLength;
  }
  return out.buffer;
}
