/**
 * Audio chunker — splits a recorded/uploaded audio Blob into smaller WAV chunks
 * (default 5 min) for parallel transcription on the server.
 *
 * Why WAV? Whisper accepts most formats, but slicing webm/ogg containers in the
 * browser without re-encoding produces invalid streams. Decoding to PCM and
 * re-encoding each slice as WAV is robust across input formats.
 *
 * Trade-off: WAV is heavier than the source. We use 16 kHz mono PCM 16-bit
 * (~32 kB/s ≈ ~9.6 MB per 5-minute chunk) which is well within Whisper limits
 * and dramatically reduces upload time vs full-fidelity stereo.
 */

export interface AudioChunk {
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  blob: Blob;
}

export interface ChunkOptions {
  chunkSeconds?: number;     // default 300 (5 min)
  targetSampleRate?: number; // default 16000 (Whisper-friendly)
  onProgress?: (decoded: number, total: number) => void;
}

const DEFAULT_CHUNK_SECONDS = 300;
const DEFAULT_SAMPLE_RATE = 16000;

/**
 * Returns true when the audio is long enough to benefit from chunking.
 * Below this threshold we send the original blob as-is.
 */
export function shouldChunkAudio(durationSec: number, threshold = DEFAULT_CHUNK_SECONDS) {
  return durationSec > threshold;
}

/**
 * Probe duration without doing a full decode. Uses an HTMLAudioElement which is
 * cheap and works for any browser-supported codec.
 */
export function probeAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(url);
      // Some recorded webm blobs report Infinity until first seek
      if (!isFinite(d) || isNaN(d)) {
        // Fallback: try seeking far ahead, then re-read
        audio.currentTime = 1e9;
        audio.ontimeupdate = () => {
          const fixed = audio.duration;
          audio.ontimeupdate = null;
          resolve(isFinite(fixed) ? fixed : 0);
        };
      } else {
        resolve(d);
      }
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a duração do áudio"));
    };
    audio.src = url;
  });
}

/**
 * Split a blob into WAV chunks. Decodes once into mono 16 kHz PCM, then slices
 * the PCM buffer and wraps each slice in a WAV container.
 */
export async function chunkAudioBlob(
  blob: Blob,
  options: ChunkOptions = {},
): Promise<AudioChunk[]> {
  const chunkSeconds = options.chunkSeconds ?? DEFAULT_CHUNK_SECONDS;
  const targetSampleRate = options.targetSampleRate ?? DEFAULT_SAMPLE_RATE;

  const arrayBuffer = await blob.arrayBuffer();

  // OfflineAudioContext is widely supported and lets us downsample on decode.
  const AudioCtx: typeof OfflineAudioContext =
    (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const TempCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;

  if (!AudioCtx || !TempCtx) {
    throw new Error("Web Audio API indisponível neste navegador");
  }

  // Decode at the source sample rate first
  const tempCtx = new TempCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    void tempCtx.close().catch(() => {});
  }

  // Downsample to mono targetSampleRate using OfflineAudioContext
  const totalSamples = Math.ceil((decoded.duration * targetSampleRate));
  const offline = new AudioCtx(1, totalSamples, targetSampleRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const monoBuffer = await offline.startRendering();
  const monoData = monoBuffer.getChannelData(0);

  options.onProgress?.(monoBuffer.duration, monoBuffer.duration);

  const chunks: AudioChunk[] = [];
  const samplesPerChunk = chunkSeconds * targetSampleRate;
  const totalChunks = Math.max(1, Math.ceil(monoData.length / samplesPerChunk));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * samplesPerChunk;
    const end = Math.min(start + samplesPerChunk, monoData.length);
    const slice = monoData.subarray(start, end);
    const wavBlob = encodeWav(slice, targetSampleRate);
    chunks.push({
      index: i,
      startSec: start / targetSampleRate,
      endSec: end / targetSampleRate,
      durationSec: (end - start) / targetSampleRate,
      blob: wavBlob,
    });
  }

  return chunks;
}

/**
 * Encode a Float32 PCM channel into a 16-bit mono WAV blob.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM format
  view.setUint16(22, 1, true);           // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);           // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // PCM samples (clamped & scaled to int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Run a list of async tasks with bounded concurrency. Preserves input order in
 * the resulting array. Used to parallelize chunk transcriptions.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}
