/**
 * Hakata Sampler - Koala Style UI
 * 16パッド × 3バンク = 48サンプル対応
 * 上部エディター + 下部パッドグリッド
 */

import './style.css';
import { audioEngine } from './audio/engine.js';
import { Sequencer } from './audio/sequencer.js';
import { EffectsEngine } from './audio/effects.js';

// アプリケーション状態
const state = {
  currentTab: 'sample',
  currentBank: 1,
  keysMode: false,
  selectedPad: 1,  // 1-16
  bpm: 120,
  playingPads: new Set(),
  // エディター設定
  playMode: 'oneshot', // 'oneshot', 'loop'
  reverse: false,
  // シーケンサー
  swing: 0,
  // エフェクト
  fx: {
    reverb: 0,
    delay: 0,
    delayTime: 0.3,
    filter: 1, // 1 = オフ
    resonance: 0
  },
  // サンプルコピー
  copiedSample: null
};

// エフェクトエンジン（後で初期化）
let effectsEngine = null;

// シーケンサー
const sequencer = new Sequencer(audioEngine);

// パッドID取得
function getPadId(padIndex) {
  return `${state.currentBank}-${padIndex}`;
}

// サンプルデータを事前に準備（AudioContext初期化なし）
// ユーザー操作時に初めてAudioContextを初期化
let samplesInitialized = false;

async function initializeSamples() {
  if (samplesInitialized) return;

  await audioEngine.init();
  const sampleRate = audioEngine.context.sampleRate;

  // バンク1: 伯方の塩サンプルをロード
  const hakataSamples = [
    { id: '1-1', file: '/samples/chop_伯方の塩.wav', label: '伯方の塩' },
    { id: '1-2', file: '/samples/chop_は.wav', label: 'は' },
    { id: '1-3', file: '/samples/chop_か.wav', label: 'か' },
    { id: '1-4', file: '/samples/chop_た.wav', label: 'た' },
    { id: '1-5', file: '/samples/chop_の.wav', label: 'の' },
    { id: '1-6', file: '/samples/chop_し.wav', label: 'し' },
    { id: '1-7', file: '/samples/chop_お.wav', label: 'お' }
  ];

  for (const sample of hakataSamples) {
    try {
      const response = await fetch(sample.file);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioEngine.context.decodeAudioData(arrayBuffer);
      audioEngine.samples.set(sample.id, {
        buffer: audioBuffer,
        settings: { volume: 1.0, pitch: 1.0, pan: 0, trimStart: 0, trimEnd: 1, loop: false }
      });
    } catch (e) {
      console.error(`Failed to load ${sample.label}:`, e);
    }
  }

  // バンク2: ドラムセット（9パッド）
  const drumSounds = [
    { id: '2-1', name: 'Kick', gen: () => generateKick(sampleRate) },
    { id: '2-2', name: 'Snare', gen: () => generateSnare(sampleRate) },
    { id: '2-3', name: 'Clap', gen: () => generateClap(sampleRate) },
    { id: '2-4', name: 'Hi-Hat Closed', gen: () => generateHiHat(sampleRate, 0.1) },
    { id: '2-5', name: 'Hi-Hat Open', gen: () => generateHiHat(sampleRate, 0.4) },
    { id: '2-6', name: 'Tom', gen: () => generateTom(sampleRate, 150) },
    { id: '2-7', name: 'Crash', gen: () => generateCrash(sampleRate) },
    { id: '2-8', name: '808 Kick', gen: () => generate808Kick(sampleRate) },
    { id: '2-9', name: 'Shaker', gen: () => generateShaker(sampleRate) }
  ];

  for (const drum of drumSounds) {
    const buffer = drum.gen();
    audioEngine.samples.set(drum.id, {
      buffer: buffer,
      settings: { volume: 1.0, pitch: 1.0, pan: 0, trimStart: 0, trimEnd: 1, loop: false }
    });
  }

  // バンク3: シンセ & FX（9パッド）
  const synthSounds = [
    { id: '3-1', name: 'Sub Bass', gen: () => generateSubBass(sampleRate) },
    { id: '3-2', name: 'Acid Bass', gen: () => generateAcidBass(sampleRate) },
    { id: '3-3', name: 'Pluck', gen: () => generatePluck(sampleRate) },
    { id: '3-4', name: 'Pad', gen: () => generatePad(sampleRate) },
    { id: '3-5', name: 'Lead', gen: () => generateLead(sampleRate) },
    { id: '3-6', name: 'Stab', gen: () => generateStab(sampleRate) },
    { id: '3-7', name: 'Rise FX', gen: () => generateRiseFX(sampleRate) },
    { id: '3-8', name: 'Noise Hit', gen: () => generateNoiseHit(sampleRate) },
    { id: '3-9', name: 'FM Bell', gen: () => generateFMBell(sampleRate) }
  ];

  for (const synth of synthSounds) {
    const buffer = synth.gen();
    audioEngine.samples.set(synth.id, {
      buffer: buffer,
      settings: { volume: 1.0, pitch: 1.0, pan: 0, trimStart: 0, trimEnd: 1, loop: false }
    });
  }

  console.log('Drum kit loaded on Bank B, Synth/FX loaded on Bank C');
  samplesInitialized = true;
}

// ===== ドラム合成関数 =====
function generateKick(sr) {
  const ctx = audioEngine.context;
  const dur = 0.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freqEnv = 150 * Math.exp(-t * 40) + 40;
    const ampEnv = Math.exp(-t * 10);
    data[i] = Math.sin(2 * Math.PI * freqEnv * t) * ampEnv * 0.9;
  }
  return buf;
}

function generateSnare(sr) {
  const ctx = audioEngine.context;
  const dur = 0.3;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 20);
    const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 30);
    data[i] = (noise * 0.6 + tone * 0.4) * 0.8;
  }
  return buf;
}

function generateClap(sr) {
  const ctx = audioEngine.context;
  const dur = 0.2;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1);
    const env = Math.exp(-t * 30) * (1 + Math.sin(t * 200) * 0.3);
    data[i] = noise * env * 0.7;
  }
  return buf;
}

function generateHiHat(sr, decay) {
  const ctx = audioEngine.context;
  const dur = 0.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t / decay) * 0.5;
  }
  return buf;
}

function generateTom(sr, freq) {
  const ctx = audioEngine.context;
  const dur = 0.4;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const f = freq * Math.exp(-t * 10);
    data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8) * 0.8;
  }
  return buf;
}

function generateCrash(sr) {
  const ctx = audioEngine.context;
  const dur = 1.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2) * 0.6;
  }
  return buf;
}

function generateRide(sr) {
  const ctx = audioEngine.context;
  const dur = 1.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const tone = Math.sin(2 * Math.PI * 400 * t) * 0.3;
    const noise = (Math.random() * 2 - 1) * 0.4;
    data[i] = (tone + noise) * Math.exp(-t * 3) * 0.5;
  }
  return buf;
}

function generateRim(sr) {
  const ctx = audioEngine.context;
  const dur = 0.1;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 100) * 0.6;
  }
  return buf;
}

function generateCowbell(sr) {
  const ctx = audioEngine.context;
  const dur = 0.3;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = (Math.sin(2 * Math.PI * 560 * t) + Math.sin(2 * Math.PI * 845 * t) * 0.6) * Math.exp(-t * 15) * 0.5;
  }
  return buf;
}

function generateShaker(sr) {
  const ctx = audioEngine.context;
  const dur = 0.15;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 30) * 0.4;
  }
  return buf;
}

function generate808Kick(sr) {
  const ctx = audioEngine.context;
  const dur = 0.8;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 50 + 100 * Math.exp(-t * 50);
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 4) * 0.95;
  }
  return buf;
}

function generate808Snare(sr) {
  const ctx = audioEngine.context;
  const dur = 0.4;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const noise = (Math.random() * 2 - 1) * Math.exp(-t * 15);
    const tone = Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 25);
    data[i] = (noise * 0.7 + tone * 0.3) * 0.85;
  }
  return buf;
}

function generateClaves(sr) {
  const ctx = audioEngine.context;
  const dur = 0.1;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = Math.sin(2 * Math.PI * 2500 * t) * Math.exp(-t * 80) * 0.6;
  }
  return buf;
}

// ===== シンセ/FX合成 =====
function generateSubBass(sr) {
  const ctx = audioEngine.context;
  const dur = 1.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freq = 55;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 2);
    data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.9;
  }
  return buf;
}

function generateAcidBass(sr) {
  const ctx = audioEngine.context;
  const dur = 0.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freq = 80;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const filterEnv = 2000 * Math.exp(-t * 10) + 200;
    const saw = (t * freq % 1) * 2 - 1;
    const filtered = saw * Math.min(1, filterEnv / 1000);
    data[i] = filtered * Math.exp(-t * 4) * 0.7;
  }
  return buf;
}

function generatePluck(sr) {
  const ctx = audioEngine.context;
  const dur = 0.8;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freq = 440;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 8);
    data[i] = (Math.sin(2 * Math.PI * freq * t) + Math.sin(4 * Math.PI * freq * t) * 0.5) * env * 0.5;
  }
  return buf;
}

function generatePad(sr) {
  const ctx = audioEngine.context;
  const dur = 2.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freqs = [220, 277, 330, 440];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t * 2)) * Math.exp(-t * 0.5);
    let sum = 0;
    for (const f of freqs) sum += Math.sin(2 * Math.PI * f * t);
    data[i] = sum / freqs.length * env * 0.4;
  }
  return buf;
}

function generateLead(sr) {
  const ctx = audioEngine.context;
  const dur = 1.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freq = 523;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const vibrato = Math.sin(2 * Math.PI * 6 * t) * 10;
    const wave = Math.sin(2 * Math.PI * (freq + vibrato) * t);
    data[i] = wave * Math.exp(-t * 2) * 0.6;
  }
  return buf;
}

function generateArp(sr) {
  const ctx = audioEngine.context;
  const dur = 0.3;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 880 * Math.pow(2, -Math.floor(t * 16) / 12);
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.5;
  }
  return buf;
}

function generateStab(sr) {
  const ctx = audioEngine.context;
  const dur = 0.15;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freqs = [261.63, 329.63, 392.00, 523.25];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    let sum = 0;
    for (const f of freqs) sum += Math.sin(2 * Math.PI * f * t);
    data[i] = sum / freqs.length * Math.exp(-t * 30) * 0.8;
  }
  return buf;
}

function generateChord(sr) {
  const ctx = audioEngine.context;
  const dur = 1.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freqs = [130.81, 164.81, 196.00, 261.63];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 1.5);
    let sum = 0;
    for (const f of freqs) sum += Math.sin(2 * Math.PI * f * t);
    data[i] = sum / freqs.length * env * 0.5;
  }
  return buf;
}

function generateRiseFX(sr) {
  const ctx = audioEngine.context;
  const dur = 2.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 100 + t * 2000;
    const noise = (Math.random() * 2 - 1) * 0.3;
    data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.5 + noise) * (t / dur) * 0.6;
  }
  return buf;
}

function generateDownFX(sr) {
  const ctx = audioEngine.context;
  const dur = 1.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 2000 * Math.exp(-t * 3);
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 1.5) * 0.6;
  }
  return buf;
}

function generateNoiseHit(sr) {
  const ctx = audioEngine.context;
  const dur = 0.3;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.8;
  }
  return buf;
}

function generateLaser(sr) {
  const ctx = audioEngine.context;
  const dur = 0.5;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const freq = 1000 * Math.exp(-t * 8) + 100;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 5) * 0.7;
  }
  return buf;
}

function generateWobble(sr) {
  const ctx = audioEngine.context;
  const dur = 1.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const baseFreq = 80;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const lfo = Math.sin(2 * Math.PI * 4 * t);
    const freq = baseFreq * (1 + lfo * 0.5);
    const saw = (t * freq % 1) * 2 - 1;
    data[i] = saw * Math.exp(-t * 1.5) * 0.6;
  }
  return buf;
}

function generateFMBell(sr) {
  const ctx = audioEngine.context;
  const dur = 2.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const carrier = 440;
  const modulator = 880;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const modEnv = Math.exp(-t * 3);
    const mod = Math.sin(2 * Math.PI * modulator * t) * 500 * modEnv;
    data[i] = Math.sin(2 * Math.PI * (carrier + mod) * t) * Math.exp(-t * 1.5) * 0.5;
  }
  return buf;
}

function generateStrings(sr) {
  const ctx = audioEngine.context;
  const dur = 2.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freqs = [220, 330, 440];
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t * 3)) * Math.exp(-t * 0.3);
    let sum = 0;
    for (const f of freqs) {
      const vib = Math.sin(2 * Math.PI * 5 * t) * 3;
      sum += Math.sin(2 * Math.PI * (f + vib) * t);
    }
    data[i] = sum / freqs.length * env * 0.4;
  }
  return buf;
}

function generateBrass(sr) {
  const ctx = audioEngine.context;
  const dur = 1.0;
  const buf = ctx.createBuffer(1, sr * dur, sr);
  const data = buf.getChannelData(0);
  const freq = 220;
  for (let i = 0; i < data.length; i++) {
    const t = i / sr;
    const env = (1 - Math.exp(-t * 10)) * Math.exp(-t * 1.5);
    const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 +
      Math.sin(4 * Math.PI * freq * t) * 0.3 +
      Math.sin(6 * Math.PI * freq * t) * 0.15 +
      Math.sin(8 * Math.PI * freq * t) * 0.08;
    data[i] = wave * env * 0.6;
  }
  return buf;
}

// パッドの波形をミニキャンバスに描画（塩パーティクル版）
function drawPadWaveform(canvas, padId) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const buffer = audioEngine.getBuffer(padId);

  // キャンバスサイズ設定
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  // 背景クリア（透明）
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!buffer) return;

  // 塩パーティクルを描画（形状追従型・普通に見やすい波形だが粒）
  // データの間引きステップ
  const step = Math.ceil(data.length / canvas.width);

  for (let i = 0; i < canvas.width; i += 1) { // 1px刻みで描画
    let min = 1.0;
    let max = -1.0;

    // このピクセル範囲の最大・最小値を取得（正確な波形形状）
    for (let j = 0; j < step; j++) {
      const idx = (i * step) + j;
      if (idx < data.length) {
        const datum = data[idx];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
    }

    // 描画範囲（Y座標）
    const yMin = (1 + min) * amp;
    const yMax = (1 + max) * amp;
    const height = Math.max(1, yMax - yMin); // 最低1px

    // この縦線ラインを埋める粒子の数を決定（高さに応じて密度を変える）
    // 「ほぼ普通の波形」に見えるように密度高め
    const density = 0.8; // 1pxあたり0.8個（適度な隙間）
    const numDots = Math.max(1, Math.floor(height * density));

    for (let k = 0; k < numDots; k++) {
      // 範囲内にランダム配置
      const y = yMin + Math.random() * height;

      // 少しまばら感を出すためにxも微妙にずらす
      const x = i + (Math.random() - 0.5) * 0.8;

      // 粒のサイズ（小さく均一に）
      const size = 0.5 + Math.random() * 0.3;

      // 色：かなり濃くして視認性確保
      const alpha = 0.5 + Math.random() * 0.5;
      ctx.fillStyle = `rgba(20, 70, 120, ${alpha})`;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 上部エディターの波形描画（塩パーティクル版・形状重視）
function drawEditorWaveform() {
  const canvas = document.getElementById('editorWaveform');
  if (!canvas) return;

  const container = canvas.parentElement;
  const ctx = canvas.getContext('2d');

  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  const padId = getPadId(state.selectedPad);
  const buffer = audioEngine.getBuffer(padId);

  // 背景（薄い青）
  ctx.fillStyle = '#E8F4FC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!buffer) {
    ctx.fillStyle = '#5D6D7E';
    ctx.font = '12px "M PLUS Rounded 1c"';
    ctx.textAlign = 'center';
    ctx.fillText('パッドを選択してください', canvas.width / 2, canvas.height / 2);
    return;
  }

  const data = buffer.getChannelData(0);
  const settings = audioEngine.getSettings(padId);
  const amp = canvas.height / 2;
  const step = Math.ceil(data.length / canvas.width);

  // 塩パーティクルを描画（形状追従型）
  for (let i = 0; i < canvas.width; i += 1) {
    let min = 1.0;
    let max = -1.0;

    for (let j = 0; j < step; j++) {
      const idx = (i * step) + j;
      if (idx < data.length) {
        const datum = data[idx];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
    }

    const yMin = (1 + min) * amp;
    const yMax = (1 + max) * amp;
    const height = Math.max(1, yMax - yMin);

    // エディターは大きいので密度を高めに
    const density = 1.2;
    const numDots = Math.max(1, Math.floor(height * density));

    for (let k = 0; k < numDots; k++) {
      const y = yMin + Math.random() * height;
      const x = i + (Math.random() - 0.5); // 少し散らす

      const size = 0.6 + Math.random() * 0.4;
      const alpha = 0.6 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(20, 80, 140, ${alpha})`;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // トリム範囲表示（半透明オーバーレイ）
  if (settings) {
    ctx.fillStyle = 'rgba(30, 90, 140, 0.3)';
    ctx.fillRect(0, 0, canvas.width * settings.trimStart, canvas.height);
    ctx.fillRect(canvas.width * settings.trimEnd, 0, canvas.width * (1 - settings.trimEnd), canvas.height);
  }
}

// UIレンダリング
function render() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <!-- タブ -->
    <nav class="tabs">
      <button class="tabs__btn ${state.currentTab === 'sample' ? 'tabs__btn--active' : ''}" data-tab="sample">SAMPLE</button>
      <button class="tabs__btn ${state.currentTab === 'sequence' ? 'tabs__btn--active' : ''}" data-tab="sequence">SEQUENCE</button>
      <button class="tabs__btn ${state.currentTab === 'fx' ? 'tabs__btn--active' : ''}" data-tab="fx">FX</button>
      <button class="tabs__menu">☰</button>
    </nav>
    
    <main class="main">
      ${state.currentTab === 'sample' ? renderSampleTab() : ''}
      ${state.currentTab === 'sequence' ? renderSequenceTab() : ''}
      ${state.currentTab === 'fx' ? renderFxTab() : ''}
    </main>
    
    <input type="file" id="fileInput" accept="audio/*" style="display: none;" />
  `;

  attachEventListeners();

  // 波形描画（少し遅延させる）
  setTimeout(() => {
    drawEditorWaveform();
    drawAllPadWaveforms();
  }, 50);
}

// SAMPLEタブ
function renderSampleTab() {
  const padId = getPadId(state.selectedPad);
  const settings = audioEngine.getSettings(padId) || {
    volume: 1.0,
    pitch: 1.0,
    loop: false
  };

  return `
    <!-- 上部エディター -->
    <div class="editor-panel ${audioEngine.hasSample(padId) ? 'editor-panel--active' : ''}">
      <div class="waveform-display">
        <canvas id="editorWaveform"></canvas>
      </div>
      
      <div class="waveform-controls">
        <button class="waveform-nav">◀</button>
        
        <div class="mode-btns">
          <button class="mode-btn ${state.playMode === 'oneshot' ? 'mode-btn--active' : ''}" data-mode="oneshot">ONE SHOT</button>
          <button class="mode-btn ${state.reverse ? 'mode-btn--active' : ''}" data-mode="reverse">REVERSE</button>
          <button class="mode-btn ${settings.loop ? 'mode-btn--active' : ''}" data-mode="loop">LOOP</button>
        </div>
        
        <button class="waveform-nav">▶</button>
      </div>
      
      <div class="param-controls">
        <div class="knob-group">
          <div class="knob" data-param="volume" data-value="${settings.volume}">
            <div class="knob__indicator" style="transform: rotate(${(settings.volume - 0.5) * 270}deg)"></div>
          </div>
          <span class="knob__label">VOL</span>
          <span class="knob__value">${Math.round(settings.volume * 100)}%</span>
        </div>
        
        <div class="knob-group">
          <div class="knob" data-param="pitch" data-value="${settings.pitch}">
            <div class="knob__indicator" style="transform: rotate(${(settings.pitch - 1) * 135}deg)"></div>
          </div>
          <span class="knob__label">PITCH</span>
          <span class="knob__value">${Math.round(settings.pitch * 100)}%</span>
        </div>
        
        <div class="knob-group">
          <div class="knob" data-param="pan" data-value="${settings.pan || 0}">
            <div class="knob__indicator" style="transform: rotate(${(settings.pan || 0) * 135}deg)"></div>
          </div>
          <span class="knob__label">PAN</span>
          <span class="knob__value">${(settings.pan || 0) > 0 ? 'R' : (settings.pan || 0) < 0 ? 'L' : 'C'}</span>
        </div>
        
        <div class="action-btns">
          <button class="action-btn" id="editBtn">EDIT</button>
          <button class="action-btn action-btn--danger" id="deleteBtn">DELETE</button>
        </div>
      </div>
    </div>
    
    <!-- パッドグリッド -->
    <div class="pad-grid">
      ${renderPads()}
    </div>
    
    <!-- フッター -->
    <div class="footer-controls">
      <div class="bank-btns">
        ${[1, 2, 3].map(bank => `
          <button class="bank-btn ${state.currentBank === bank ? 'bank-btn--active' : ''}" data-bank="${bank}">${String.fromCharCode(64 + bank)}</button>
        `).join('')}
      </div>
      
      <button class="keys-btn ${state.keysMode ? 'keys-btn--active' : ''}" id="keysBtn">
        🎹 KEYS
      </button>
      
      <span class="samples-label">
        ∧ SAMPLES
      </span>
    </div>
  `;
}

// パッドレンダリング（3x3 = 9パッド）
function renderPads() {
  const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C\'', 'D\''];

  return Array.from({ length: 9 }, (_, i) => {
    const padIndex = i + 1;
    const padId = getPadId(padIndex);
    const hasSample = audioEngine.hasSample(padId);
    const isSelected = state.selectedPad === padIndex;
    const isPlaying = state.playingPads.has(padId);

    let padClass = 'pad';
    if (hasSample) padClass += ' pad--has-sample';
    if (isSelected) padClass += ' pad--selected';
    if (isPlaying) padClass += ' pad--playing';
    if (state.keysMode) padClass += ' pad--keys-mode';

    return `
      <button class="${padClass}" data-pad="${padIndex}">
        <canvas data-pad-canvas="${padIndex}"></canvas>
        ${state.keysMode ? `<span class="pad__note">${noteNames[i]}</span>` : ''}
        <span class="pad__number">${padIndex}</span>
      </button>
    `;
  }).join('');
}

// すべてのパッド波形を描画
function drawAllPadWaveforms() {
  for (let i = 1; i <= 9; i++) {
    const canvas = document.querySelector(`[data-pad-canvas="${i}"]`);
    if (canvas) {
      drawPadWaveform(canvas, getPadId(i));
    }
  }
}

// SEQUENCEタブ
function renderSequenceTab() {
  return `
    <div class="sequencer">
      ${Array.from({ length: 16 }, (_, i) => {
    const padIndex = i + 1;
    const padId = getPadId(padIndex);
    return `
          <div class="sequencer__track">
            <div class="sequencer__track-label">${padIndex}</div>
            <div class="sequencer__steps">
              ${Array.from({ length: 16 }, (_, step) => {
      const isActive = sequencer.isStepActive(padId, step);
      const isCurrent = sequencer.currentStep === step && sequencer.isPlaying;
      let stepClass = 'sequencer__step';
      if (isActive) stepClass += ' sequencer__step--active';
      if (isCurrent) stepClass += ' sequencer__step--current';
      return `<button class="${stepClass}" data-seq-pad="${padIndex}" data-seq-step="${step}"></button>`;
    }).join('')}
            </div>
          </div>
        `;
  }).join('')}
    </div>
    
    <!-- トランスポート＆コントロール -->
    <div class="seq-controls">
      <!-- パターンスロット -->
      <div class="pattern-slots">
        <span class="pattern-slots__label">PATTERN</span>
        ${[0, 1, 2, 3].map(slot => `
          <button class="pattern-slot ${sequencer.currentPatternSlot === slot ? 'pattern-slot--active' : ''} ${sequencer.isPatternSaved(slot) ? 'pattern-slot--saved' : ''}" data-pattern="${slot}">
            ${slot + 1}
          </button>
        `).join('')}
        <button class="pattern-action" id="savePattern">SAVE</button>
        <button class="pattern-action pattern-action--danger" id="clearPattern">CLR</button>
      </div>
      
      <!-- スイング -->
      <div class="swing-control">
        <span class="swing-control__label">SWING</span>
        <input type="range" id="swingSlider" min="0" max="100" value="${state.swing}" class="swing-slider" />
        <span class="swing-control__value">${state.swing}%</span>
      </div>
    </div>
    
    <div class="transport-bar">
      <div class="bpm-control">
        <button class="tap-btn" id="tapBtn">TAP</button>
        <button class="bpm-control__btn" id="bpmDown">−</button>
        <span class="bpm-control__value" id="bpmValue">${state.bpm}</span>
        <button class="bpm-control__btn" id="bpmUp">+</button>
      </div>
      
      <button class="play-btn ${sequencer.isPlaying ? 'play-btn--playing' : ''}" id="playBtn">
        ${sequencer.isPlaying ? '⏹' : '▶'}
      </button>
    </div>
  `;
}

// FXタブ（マスターエフェクト）
function renderFxTab() {
  return `
    <div class="fx-panel">
      <h3 class="fx-panel__title">MASTER FX</h3>
      
      <!-- リバーブ -->
      <div class="fx-control">
        <div class="fx-control__header">
          <span class="fx-control__icon">🔊</span>
          <span class="fx-control__name">REVERB</span>
          <span class="fx-control__value" id="reverbValue">${Math.round(state.fx.reverb * 100)}%</span>
        </div>
        <input type="range" id="reverbSlider" min="0" max="100" value="${state.fx.reverb * 100}" class="fx-slider" />
      </div>
      
      <!-- ディレイ -->
      <div class="fx-control">
        <div class="fx-control__header">
          <span class="fx-control__icon">🔁</span>
          <span class="fx-control__name">DELAY</span>
          <span class="fx-control__value" id="delayValue">${Math.round(state.fx.delay * 100)}%</span>
        </div>
        <input type="range" id="delaySlider" min="0" max="100" value="${state.fx.delay * 100}" class="fx-slider" />
      </div>
      
      <!-- ディレイタイム -->
      <div class="fx-control">
        <div class="fx-control__header">
          <span class="fx-control__icon">⏱</span>
          <span class="fx-control__name">DELAY TIME</span>
          <span class="fx-control__value" id="delayTimeValue">${Math.round(state.fx.delayTime * 1000)}ms</span>
        </div>
        <input type="range" id="delayTimeSlider" min="5" max="100" value="${state.fx.delayTime * 100}" class="fx-slider" />
      </div>
      
      <!-- フィルター -->
      <div class="fx-control">
        <div class="fx-control__header">
          <span class="fx-control__icon">🎚</span>
          <span class="fx-control__name">FILTER</span>
          <span class="fx-control__value" id="filterValue">${state.fx.filter < 1 ? Math.round(100 + state.fx.filter * 19900) + 'Hz' : 'OFF'}</span>
        </div>
        <input type="range" id="filterSlider" min="0" max="100" value="${state.fx.filter * 100}" class="fx-slider" />
      </div>
      
      <!-- フィルターレゾナンス -->
      <div class="fx-control">
        <div class="fx-control__header">
          <span class="fx-control__icon">〰</span>
          <span class="fx-control__name">RESONANCE</span>
          <span class="fx-control__value" id="resValue">${Math.round(state.fx.resonance * 100)}%</span>
        </div>
        <input type="range" id="resSlider" min="0" max="100" value="${state.fx.resonance * 100}" class="fx-slider" />
      </div>
    </div>
    
    <!-- サンプルコピー/ペースト -->
    <div class="sample-actions">
      <h3 class="sample-actions__title">SAMPLE OP</h3>
      <div class="sample-actions__btns">
        <button class="sample-action-btn" id="copyBtn">📋 COPY</button>
        <button class="sample-action-btn" id="pasteBtn">📝 PASTE</button>
      </div>
      <p class="sample-actions__hint">
        ${state.copiedSample ? `コピー済: Pad ${state.copiedSample.split('-')[1]}` : 'パッドを選択してCOPY'}
      </p>
    </div>
  `;
}

// イベントリスナー
function attachEventListeners() {
  // タブ切り替え
  document.querySelectorAll('.tabs__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentTab = btn.dataset.tab;
      render();
    });
  });

  // パッドクリック
  document.querySelectorAll('.pad').forEach(pad => {
    const handlePadPress = async (e) => {
      e.preventDefault();
      await audioEngine.init();

      const padIndex = parseInt(pad.dataset.pad);
      const padId = getPadId(padIndex);

      // 選択状態を更新
      state.selectedPad = padIndex;

      // サンプル再生
      if (state.keysMode) {
        const noteNames = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ', 'ド↑'];
        const noteIndex = (padIndex - 1) % 8;
        const noteName = noteNames[noteIndex];
        audioEngine.playWithNote(padId, noteName);
      } else {
        audioEngine.play(padId, null, state.reverse);
      }

      // ビジュアルフィードバック
      state.playingPads.add(padId);

      // 再レンダリング
      render();

      setTimeout(() => {
        state.playingPads.delete(padId);
        const currentPad = document.querySelector(`[data-pad="${padIndex}"]`);
        if (currentPad) currentPad.classList.remove('pad--playing');
      }, 200);
    };

    pad.addEventListener('touchstart', handlePadPress, { passive: false });
    pad.addEventListener('mousedown', handlePadPress);
  });

  // バンク切り替え
  document.querySelectorAll('.bank-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentBank = parseInt(btn.dataset.bank);
      render();
    });
  });

  // KEYSモード
  const keysBtn = document.getElementById('keysBtn');
  if (keysBtn) {
    keysBtn.addEventListener('click', () => {
      state.keysMode = !state.keysMode;
      render();
    });
  }

  // モードボタン
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      const padId = getPadId(state.selectedPad);

      if (mode === 'oneshot') {
        state.playMode = 'oneshot';
        audioEngine.updateSettings(padId, { loop: false });
      } else if (mode === 'loop') {
        const settings = audioEngine.getSettings(padId);
        const newLoop = !settings?.loop;
        audioEngine.updateSettings(padId, { loop: newLoop });
      } else if (mode === 'reverse') {
        state.reverse = !state.reverse;
      }

      render();
    });
  });

  // VOL/PITCH/PANノブ（タッチ/マウスドラッグ）
  document.querySelectorAll('.knob').forEach(knob => {
    let startY = 0;
    let startValue = 0;

    const handleStart = (e) => {
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      startY = touch.clientY;
      startValue = parseFloat(knob.dataset.value) || 0;

      const handleMove = (moveEvent) => {
        const moveTouch = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
        const deltaY = startY - moveTouch.clientY;
        const param = knob.dataset.param;
        const padId = getPadId(state.selectedPad);

        let newValue, displayValue;

        if (param === 'volume') {
          newValue = Math.max(0, Math.min(1, startValue + deltaY * 0.01));
          displayValue = `${Math.round(newValue * 100)}%`;
        } else if (param === 'pitch') {
          newValue = Math.max(0.5, Math.min(2, startValue + deltaY * 0.01));
          displayValue = `${Math.round(newValue * 100)}%`;
        } else if (param === 'pan') {
          newValue = Math.max(-1, Math.min(1, startValue + deltaY * 0.02));
          displayValue = newValue > 0.05 ? 'R' : newValue < -0.05 ? 'L' : 'C';
        }

        knob.dataset.value = newValue;
        audioEngine.updateSettings(padId, { [param]: newValue });

        const indicator = knob.querySelector('.knob__indicator');
        if (indicator) {
          let rotation;
          if (param === 'volume') rotation = (newValue - 0.5) * 270;
          else if (param === 'pitch') rotation = (newValue - 1) * 135;
          else rotation = newValue * 135;
          indicator.style.transform = `rotate(${rotation}deg)`;
        }

        const valueEl = knob.parentElement.querySelector('.knob__value');
        if (valueEl) valueEl.textContent = displayValue;
      };

      const handleEnd = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleEnd);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', handleEnd);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleMove, { passive: false });
      document.addEventListener('touchend', handleEnd);
    };

    knob.addEventListener('mousedown', handleStart);
    knob.addEventListener('touchstart', handleStart, { passive: false });
  });

  // 編集ボタン（ファイルインポート）
  const editBtn = document.getElementById('editBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const fileInput = document.getElementById('fileInput');

  if (editBtn && fileInput) {
    editBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const padId = getPadId(state.selectedPad);
          await audioEngine.loadSample(padId, file);
          render();
        } catch (error) {
          console.error('サンプル読み込みエラー:', error);
          alert('サンプルの読み込みに失敗しました');
        }
      }
      fileInput.value = '';
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const padId = getPadId(state.selectedPad);
      audioEngine.samples.delete(padId);
      render();
    });
  }

  // BPM
  const bpmDown = document.getElementById('bpmDown');
  const bpmUp = document.getElementById('bpmUp');

  if (bpmDown) {
    bpmDown.addEventListener('click', () => {
      state.bpm = Math.max(60, state.bpm - 5);
      sequencer.setBpm(state.bpm);
      document.getElementById('bpmValue').textContent = state.bpm;
    });
  }

  if (bpmUp) {
    bpmUp.addEventListener('click', () => {
      state.bpm = Math.min(200, state.bpm + 5);
      sequencer.setBpm(state.bpm);
      document.getElementById('bpmValue').textContent = state.bpm;
    });
  }

  // 再生ボタン
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', async () => {
      await audioEngine.init();
      if (sequencer.isPlaying) {
        sequencer.stop();
      } else {
        sequencer.start();
      }
      render();
    });
  }

  // シーケンサーステップ
  document.querySelectorAll('.sequencer__step').forEach(step => {
    step.addEventListener('click', () => {
      const padIndex = parseInt(step.dataset.seqPad);
      const padId = getPadId(padIndex);
      const stepIndex = parseInt(step.dataset.seqStep);
      sequencer.toggleStep(padId, stepIndex);
      step.classList.toggle('sequencer__step--active');
    });
  });

  // シーケンサーのステップ変更コールバック
  sequencer.onStepChange = (step) => {
    document.querySelectorAll('.sequencer__step').forEach(el => {
      el.classList.remove('sequencer__step--current');
      if (parseInt(el.dataset.seqStep) === step) {
        el.classList.add('sequencer__step--current');
      }
    });
  };

  // タップテンポ
  const tapBtn = document.getElementById('tapBtn');
  if (tapBtn) {
    tapBtn.addEventListener('click', () => {
      const newBpm = sequencer.tap();
      state.bpm = newBpm;
      const bpmValue = document.getElementById('bpmValue');
      if (bpmValue) bpmValue.textContent = newBpm;
    });
  }

  // スイング
  const swingSlider = document.getElementById('swingSlider');
  if (swingSlider) {
    swingSlider.addEventListener('input', (e) => {
      state.swing = parseInt(e.target.value);
      sequencer.setSwing(state.swing);
      const valueEl = document.querySelector('.swing-control__value');
      if (valueEl) valueEl.textContent = `${state.swing}%`;
    });
  }

  // パターンスロット
  document.querySelectorAll('.pattern-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      const slotNum = parseInt(slot.dataset.pattern);
      if (sequencer.loadPattern(slotNum)) {
        render();
      }
    });
  });

  const savePatternBtn = document.getElementById('savePattern');
  if (savePatternBtn) {
    savePatternBtn.addEventListener('click', () => {
      sequencer.savePattern(sequencer.currentPatternSlot);
      render();
    });
  }

  const clearPatternBtn = document.getElementById('clearPattern');
  if (clearPatternBtn) {
    clearPatternBtn.addEventListener('click', () => {
      sequencer.clearPattern();
      render();
    });
  }

  // FXスライダー
  const reverbSlider = document.getElementById('reverbSlider');
  if (reverbSlider) {
    reverbSlider.addEventListener('input', (e) => {
      state.fx.reverb = parseInt(e.target.value) / 100;
      if (effectsEngine) effectsEngine.setReverbAmount(state.fx.reverb);
      document.getElementById('reverbValue').textContent = `${Math.round(state.fx.reverb * 100)}%`;
    });
  }

  const delaySlider = document.getElementById('delaySlider');
  if (delaySlider) {
    delaySlider.addEventListener('input', (e) => {
      state.fx.delay = parseInt(e.target.value) / 100;
      if (effectsEngine) effectsEngine.setDelayAmount(state.fx.delay);
      document.getElementById('delayValue').textContent = `${Math.round(state.fx.delay * 100)}%`;
    });
  }

  const delayTimeSlider = document.getElementById('delayTimeSlider');
  if (delayTimeSlider) {
    delayTimeSlider.addEventListener('input', (e) => {
      state.fx.delayTime = parseInt(e.target.value) / 100;
      if (effectsEngine) effectsEngine.setDelayTime(state.fx.delayTime);
      document.getElementById('delayTimeValue').textContent = `${Math.round(state.fx.delayTime * 1000)}ms`;
    });
  }

  const filterSlider = document.getElementById('filterSlider');
  if (filterSlider) {
    filterSlider.addEventListener('input', (e) => {
      state.fx.filter = parseInt(e.target.value) / 100;
      if (effectsEngine) effectsEngine.setFilterFrequency(state.fx.filter);
      const freq = state.fx.filter < 1 ? Math.round(100 + state.fx.filter * 19900) : 'OFF';
      document.getElementById('filterValue').textContent = state.fx.filter < 1 ? freq + 'Hz' : 'OFF';
    });
  }

  const resSlider = document.getElementById('resSlider');
  if (resSlider) {
    resSlider.addEventListener('input', (e) => {
      state.fx.resonance = parseInt(e.target.value) / 100;
      if (effectsEngine) effectsEngine.setFilterResonance(state.fx.resonance);
      document.getElementById('resValue').textContent = `${Math.round(state.fx.resonance * 100)}%`;
    });
  }

  // サンプルコピー/ペースト
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const padId = getPadId(state.selectedPad);
      if (audioEngine.hasSample(padId)) {
        state.copiedSample = padId;
        render();
      }
    });
  }

  const pasteBtn = document.getElementById('pasteBtn');
  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      if (state.copiedSample) {
        const sourcePadId = state.copiedSample;
        const targetPadId = getPadId(state.selectedPad);
        const sourceSample = audioEngine.samples.get(sourcePadId);
        if (sourceSample) {
          audioEngine.samples.set(targetPadId, {
            buffer: sourceSample.buffer,
            settings: { ...sourceSample.settings }
          });
          render();
        }
      }
    });
  }
}

// 初期化
async function init() {
  // まずUIを表示
  render();

  // 最初のユーザー操作でサンプルとエフェクトを初期化
  document.addEventListener('click', async function initOnClick() {
    await initializeSamples();

    // エフェクトエンジン初期化
    if (audioEngine.context && audioEngine.masterGain) {
      effectsEngine = new EffectsEngine(audioEngine.context);
      effectsEngine.init(audioEngine.masterGain);
    }

    render();
    document.removeEventListener('click', initOnClick);
  }, { once: true });
}

init();
