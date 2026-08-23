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

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  await ctx.close();

  extractPeaks(audioBuffer);
  renderWaveform(0);

  audio.addEventListener("ended", () => {
    isPlaying = false;
    updatePlayBtnState();
    renderWaveform(0);
  });
}

function extractPeaks(buffer) {
  const channelData = buffer.getChannelData(0);
  const sampleCount = 140;
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
  const ctx = canvas.getContext("2d");

  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width) canvas.width = rect.width;
  if (canvas.height !== rect.height) canvas.height = rect.height;

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const barWidth = 3;
  const gap = 1;
  const totalBarWidth = barWidth + gap;
  const totalBars = Math.floor(width / totalBarWidth);

  for (let i = 0; i < totalBars; i++) {
    const peakIndex = Math.floor((i / totalBars) * peaks.length);
    const val = peaks[peakIndex] || 0.05;
    const barHeight = Math.max(3, val * (height - 4));
    const x = i * totalBarWidth;
    const y = (height - barHeight) / 2;

    const currentPos = i / totalBars;
    if (currentPos <= progress) {
      ctx.fillStyle = "#3b82f6";
    } else {
      ctx.fillStyle = "#33333d";
    }

    ctx.fillRect(x, y, barWidth, barHeight);
  }
}

export function togglePlay() {
  if (!audio) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
  } else {
    audio.play();
    isPlaying = true;
    trackProgress();
  }
  updatePlayBtnState();
}

function trackProgress() {
  if (!isPlaying || !audio) return;
  const progress = audio.currentTime / audio.duration;
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
