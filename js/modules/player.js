let audio = null;
let peaks = [];
let isPlaying = false;
let animationId = null;

export async function setupPlayer(arrayBuffer, fileMime) {
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (animationId) cancelAnimationFrame(animationId);
  isPlaying = false;
  updatePlayBtnState();

  const blob = new Blob([arrayBuffer], { type: fileMime });
  const url = URL.createObjectURL(blob);
  audio = new Audio(url);

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    await ctx.close();
    extractPeaks(audioBuffer);
  } catch (e) {
    console.error("Ошибка дешифровки аудио волны:", e);
    peaks = new Array(100).fill(0.2);
  }

  renderWaveform(0);

  audio.addEventListener("ended", () => {
    isPlaying = false;
    updatePlayBtnState();
    renderWaveform(0);
  });
}

function extractPeaks(buffer) {
  const channelData = buffer.getChannelData(0);
  const sampleCount = 120;
  const blockSize = Math.floor(channelData.length / sampleCount);
  peaks = [];

  for (let i = 0; i < sampleCount; i++) {
    const start = i * blockSize;
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j]);
    }
    peaks.push(sum / blockSize);
  }

  const maxPeak = Math.max(...peaks) || 1;
  peaks = peaks.map(p => p / maxPeak);
}

export function renderWaveform(progress = 0) {
  const canvas = document.getElementById("waveformCanvas");
  if (!canvas) return;
  const container = canvas.parentElement;
  if (!container) return;

  const width = container.clientWidth || 300;
  const height = container.clientHeight || 36;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);

  const barWidth = 2;
  const gap = 2;
  const totalBarWidth = barWidth + gap;
  const totalBars = Math.floor(width / totalBarWidth);

  for (let i = 0; i < totalBars; i++) {
    const peakIndex = Math.floor((i / totalBars) * peaks.length);
    const val = peaks[peakIndex] || 0.05;
    const barHeight = Math.max(2, val * (height - 6));
    const x = i * totalBarWidth;
    const y = (height - barHeight) / 2;

    const currentPos = i / totalBars;
    if (currentPos <= progress) {
      ctx.fillStyle = "#3b82f6";
    } else {
      ctx.fillStyle = "#3a3a42";
    }

    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

export function togglePlay() {
  if (!audio) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    updatePlayBtnState();
  } else {
    audio.play().then(() => {
      isPlaying = true;
      updatePlayBtnState();
      trackProgress();
    }).catch(err => console.error("Ошибка автоплея:", err));
  }
}

function trackProgress() {
  if (!isPlaying || !audio) return;
  const progress = audio.currentTime / (audio.duration || 1);
  renderWaveform(progress);
  animationId = requestAnimationFrame(trackProgress);
}

export function seekTo(ratio) {
  if (!audio || !audio.duration) return;
  audio.currentTime = ratio * audio.duration;
  renderWaveform(ratio);
}

function updatePlayBtnState() {
  const btn = document.getElementById("playPauseBtn");
  if (btn) {
    btn.textContent = isPlaying ? "Pause" : "Play";
  }
}
