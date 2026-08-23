export function buildId3TagBuffer(values, coverBytes, coverMime) {
  const t = new MP3Tag(new Uint8Array(0).buffer);
  t.read();
  t.tags.v2 = {};

  if (values.title) t.tags.v2.TIT2 = values.title;
  if (values.artist) t.tags.v2.TPE1 = values.artist;
  if (values.composer) t.tags.v2.TCOM = values.composer;
  if (values.genre) t.tags.v2.TCON = values.genre;
  if (values.year) { t.tags.v2.TYER = values.year; t.tags.v2.TDRC = values.year; }
  if (values.bpm) t.tags.v2.TBPM = values.bpm;
  if (values.key) t.tags.v2.TKEY = values.key;

  if (coverBytes) {
    t.tags.v2.APIC = [{
      format: coverMime, mime: coverMime, type: 3, description: '',
      data: Array.from(new Uint8Array(coverBytes))
    }];
  }

  t.save({ strict: false, id3v1: { include: false }, id3v2: { include: true, version: 3, padding: 0 } });
  if (t.error) throw new Error('mp3tag.js: ' + t.error);

  const raw = new Uint8Array(t.buffer);
  if (raw.length < 10 || raw[0] !== 0x49 || raw[1] !== 0x44 || raw[2] !== 0x33) {
    return new ArrayBuffer(0);
  }
  const size = ((raw[6] & 0x7f) << 21) | ((raw[7] & 0x7f) << 14) | ((raw[8] & 0x7f) << 7) | (raw[9] & 0x7f);
  return raw.slice(0, 10 + size).buffer;
}

export function readTagValue(v2, frame, fallback) {
  const v = v2[frame];
  if (v !== undefined && v !== null) {
    if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0];
      if (typeof first === 'string' || typeof first === 'number') return String(first).trim();
      if (typeof first === 'object' && first !== null) return String(first.text || first.value || '').trim();
    }
    if (typeof v === 'object') return String(v.text || v.value || '').trim();
  }
  if (fallback && String(fallback).trim() !== '') return String(fallback).trim();
  return '';
}
