export async function calculateLUFS(arrayBuffer) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decodedData = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const sampleRate = decodedData.sampleRate;
  const numChannels = decodedData.numberOfChannels;
  const length = decodedData.length;

  // Просчет через native C++ фильтры Web Audio API (OfflineAudioContext)
  const offlineCtx = new OfflineAudioContext(numChannels, length, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedData;

  // K-weighting Stage 1: High shelf filter (1500 Hz, +4 dB)
  const highShelf = offlineCtx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 1500;
  highShelf.gain.value = 4.0;

  // K-weighting Stage 2: High pass filter (38 Hz)
  const highPass = offlineCtx.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 38;

  source.connect(highShelf);
  highShelf.connect(highPass);
  highPass.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  await audioCtx.close();

  let totalMeanSquare = 0;
  const channelsToAnalyze = Math.min(numChannels, 2);

  for (let c = 0; c < channelsToAnalyze; c++) {
    const channelData = renderedBuffer.getChannelData(c);
    let sumSquare = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquare += channelData[i] * channelData[i];
    }
    totalMeanSquare += sumSquare / channelData.length;
  }

  if (totalMeanSquare <= 0) return "-inf LUFS";

  // ITU-R BS.1770 formula: LUFS = -0.691 + 10 * log10(sum_mean_squares)
  const lufs = -0.691 + 10 * Math.log10(totalMeanSquare);
  return `${lufs.toFixed(1)} LUFS`;
}
