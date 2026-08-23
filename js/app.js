import { parseRiffChunks, parseListInfo, extractId3FromWav, injectId3IntoWav } from './modules/riff.js';
import { buildId3TagBuffer, readTagValue, readCustomTxxxValue, readCommentValue } from './modules/id3.js';
import { calculateLUFS } from './modules/lufs.js';

let rawAudioBuffer = null;
let originalFileName = "";
let isWav = false;
let coverBuffer = null;
let coverMime = "";
let existingCoverData = null;

const dropZone = document.getElementById('dropZone');
const audioFileInput = document.getElementById('audioFile');
const form = document.getElementById('form');
const statusLine = document.getElementById('statusLine');
const removeCoverBtn = document.getElementById('removeCoverBtn');
const coverPreview = document.getElementById('coverPreview');
const calcLufsBtn = document.getElementById('calcLufsBtn');
const lufsInput = document.getElementById('lufs');

function setStatus(text, isErr) {
  statusLine.textContent = text || "";
  statusLine.className = "status-line" + (isErr ? " err" : "");
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false);
});
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('hover'), false);
});
['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('hover'), false);
});

dropZone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) processAudioFile(file);
});

audioFileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) processAudioFile(file);
});

async function processAudioFile(file) {
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.mp3') && !lower.endsWith('.wav')) {
    alert("Пожалуйста, выберите файл .mp3 или .wav");
    return;
  }
  isWav = lower.endsWith('.wav');
  originalFileName = file.name;
  rawAudioBuffer = await file.arrayBuffer();
  setStatus('', false);

  let v2 = {};
  let listInfo = {};

  try {
    if (isWav) {
      const chunks = parseRiffChunks(rawAudioBuffer);
      const listChunk = chunks.find(c => {
        if (c.id === 'LIST') {
          const view = new DataView(rawAudioBuffer, c.dataStart, 4);
          return String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3)) === 'INFO';
        }
        return false;
      });
      if (listChunk) listInfo = parseListInfo(rawAudioBuffer, listChunk);

      const id3Bytes = extractId3FromWav(rawAudioBuffer);
      if (id3Bytes) {
        const reader = new MP3Tag(id3Bytes);
        reader.read();
        v2 = reader.tags.v2 || {};
      }
    } else {
          const reader = new MP3Tag(rawAudioBuffer.slice(0));
          reader.read();
          v2 = reader.tags.v2 || {};
    }
  } catch (e) {
    setStatus('Не удалось прочитать теги: ' + e.message, true);
  }

  document.getElementById("title").value = readTagValue(v2, 'TIT2', listInfo.title);
  document.getElementById("artist").value = readTagValue(v2, 'TPE1', listInfo.artist);
  document.getElementById("composer").value = readTagValue(v2, 'TCOM');
  document.getElementById("key").value = readTagValue(v2, 'TKEY');
  document.getElementById("bpm").value = readTagValue(v2, 'TBPM');
  document.getElementById("year").value = readTagValue(v2, 'TDRC', listInfo.year) || readTagValue(v2, 'TYER');
  document.getElementById("genre").value = readTagValue(v2, 'TCON', listInfo.genre);
  
  lufsInput.value = readCustomTxxxValue(v2, 'LUFS');
  document.getElementById("comment").value = readCommentValue(v2);

  existingCoverData = null;
  coverBuffer = null;
  coverMime = "";
  document.getElementById("coverFile").value = "";

  let apic = v2.APIC && Array.isArray(v2.APIC) && v2.APIC.length > 0 ? v2.APIC[0] : null;
  if (apic && apic.data && apic.data.length > 0) {
    const mimeType = apic.mime || apic.format || "image/jpeg";
    existingCoverData = {
      buffer: new Uint8Array(apic.data).buffer,
      mime: mimeType
    };
    const blob = new Blob([new Uint8Array(apic.data)], { type: mimeType });
    coverPreview.src = URL.createObjectURL(blob);
    coverPreview.style.display = "block";
    removeCoverBtn.style.display = "block";
  } else {
    coverPreview.src = "";
    coverPreview.style.display = "none";
    removeCoverBtn.style.display = "none";
  }

  form.style.display = "block";
  dropZone.querySelector('label').innerHTML = `Файл загружен: <strong>${originalFileName}</strong><br>(перетащите другой, чтобы заменить)`;
}

calcLufsBtn.addEventListener("click", async () => {
  if (!rawAudioBuffer) return;
  calcLufsBtn.disabled = true;
  calcLufsBtn.textContent = "...";
  setStatus('Идет анализ громкости...', false);

  try {
    const result = await calculateLUFS(rawAudioBuffer);
    lufsInput.value = result;
    setStatus('Анализ громкости завершен', false);
  } catch (e) {
    setStatus('Ошибка анализа LUFS: ' + e.message, true);
  } finally {
    calcLufsBtn.disabled = false;
    calcLufsBtn.textContent = "Замер";
  }
});

document.getElementById("coverFile").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  coverMime = file.type || "image/jpeg";
  coverBuffer = await file.arrayBuffer();
  coverPreview.src = URL.createObjectURL(file);
  coverPreview.style.display = "block";
  removeCoverBtn.style.display = "block";
});

removeCoverBtn.addEventListener("click", () => {
  coverBuffer = null;
  coverMime = "";
  existingCoverData = null;
  document.getElementById("coverFile").value = "";
  coverPreview.src = "";
  coverPreview.style.display = "none";
  removeCoverBtn.style.display = "none";
});

document.getElementById("saveBtn").addEventListener("click", () => {
  if (!rawAudioBuffer) return;
  setStatus('Сохраняю...', false);

  const values = {
    title: document.getElementById("title").value.trim(),
    artist: document.getElementById("artist").value.trim(),
    composer: document.getElementById("composer").value.trim(),
    key: document.getElementById("key").value.trim(),
    bpm: document.getElementById("bpm").value.trim(),
    year: document.getElementById("year").value.trim(),
    genre: document.getElementById("genre").value.trim(),
    lufs: lufsInput.value.trim(),
    comment: document.getElementById("comment").value.trim(),
  };

  try {
    let outBuffer, blobMime;

    let finalCoverBytes = null;
    let finalCoverMime = "";
    if (coverBuffer) {
      finalCoverBytes = coverBuffer;
      finalCoverMime = coverMime;
    } else if (existingCoverData) {
      finalCoverBytes = existingCoverData.buffer;
      finalCoverMime = existingCoverData.mime;
    }

    if (isWav) {
      const id3Bytes = buildId3TagBuffer(values, finalCoverBytes, finalCoverMime);
      outBuffer = injectId3IntoWav(rawAudioBuffer, id3Bytes);
      blobMime = "audio/wav";
    } else {
      const writer = new MP3Tag(rawAudioBuffer.slice(0));
      writer.read();
      writer.tags.v1 = {};
      writer.tags.v2 = {};

      if (values.title) writer.tags.v2.TIT2 = values.title;
      if (values.artist) writer.tags.v2.TPE1 = values.artist;
      if (values.genre) writer.tags.v2.TCON = values.genre;
      if (values.year) { writer.tags.v2.TYER = values.year; writer.tags.v2.TDRC = values.year; }
      if (values.composer) writer.tags.v2.TCOM = values.composer;
      if (values.key) writer.tags.v2.TKEY = values.key;
      if (values.bpm) writer.tags.v2.TBPM = values.bpm;

      if (values.lufs) {
        writer.tags.v2.TXXX = [{ description: 'LUFS', text: values.lufs }];
      }
      if (values.comment) {
        writer.tags.v2.COMM = [{ language: 'eng', descriptor: '', text: values.comment }];
      }

      if (finalCoverBytes) {
        writer.tags.v2.APIC = [{
          format: finalCoverMime, mime: finalCoverMime, type: 3, description: "",
          data: Array.from(new Uint8Array(finalCoverBytes))
        }];
      }

      writer.save({ strict: false, id3v1: { include: false } });
      if (writer.error) throw new Error(writer.error);
      outBuffer = writer.buffer;
      blobMime = "audio/mpeg";
    }

    const ext = isWav ? ".wav" : ".mp3";
    let downloadName = "";
    if (values.artist && values.title) downloadName = `${values.artist} - ${values.title}${ext}`;
    else if (values.title) downloadName = `${values.title}${ext}`;
    else if (values.artist) downloadName = `${values.artist}${ext}`;
    else downloadName = originalFileName;
    downloadName = downloadName.replace(/[/\\?%*:|"<>]/g, '_');

    const blob = new Blob([outBuffer], { type: blobMime });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = downloadName;
    link.click();

    setStatus('Готово - файл скачан', false);
  } catch (e) {
    setStatus('Ошибка сохранения: ' + e.message, true);
  }
});
