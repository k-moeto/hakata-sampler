/**
 * Hakata Sampler - Audio Engine
 * Web Audio APIを使用したサウンドエンジン
 */

export class AudioEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.samples = new Map(); // padId -> { buffer, settings }
    this.activeSources = new Map(); // padId -> source
    this.lastPlayedPad = null;

    // 音階の周波数比率 (C4を基準として)
    this.noteRatios = {
      'ド': 1.0,       // C
      'レ': 1.122,     // D
      'ミ': 1.260,     // E
      'ファ': 1.335,   // F
      'ソ': 1.498,     // G
      'ラ': 1.682,     // A
      'シ': 1.888,     // B
      'ド↑': 2.0       // C (octave up)
    };

    this.noteNames = ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ', 'ド↑', '休'];
  }

  /**
   * AudioContextを初期化
   */
  async init() {
    if (this.context) return;

    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    // iOS対策: ユーザーインタラクション後にresumeする
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * オーディオファイルを読み込み
   */
  async loadSample(padId, audioFile, settings = {}) {
    await this.init();

    let arrayBuffer;

    if (audioFile instanceof ArrayBuffer) {
      arrayBuffer = audioFile;
    } else if (audioFile instanceof File || audioFile instanceof Blob) {
      arrayBuffer = await audioFile.arrayBuffer();
    } else if (typeof audioFile === 'string') {
      // URLの場合
      const response = await fetch(audioFile);
      arrayBuffer = await response.arrayBuffer();
    } else {
      throw new Error('Unsupported audio file type');
    }

    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

    this.samples.set(padId, {
      buffer: audioBuffer,
      settings: {
        volume: 1.0,
        pitch: 1.0,
        trimStart: 0,
        trimEnd: 1,
        loop: false,
        ...settings
      }
    });

    return audioBuffer;
  }

  /**
   * サンプルを再生
   */
  play(padId, pitchOverride = null, reverse = false) {
    const sample = this.samples.get(padId);
    if (!sample) return;

    // 既に再生中なら停止
    this.stop(padId);

    const source = this.context.createBufferSource();

    // リバース再生の場合はバッファを反転
    if (reverse) {
      const reversedBuffer = this.reverseBuffer(sample.buffer);
      source.buffer = reversedBuffer;
    } else {
      source.buffer = sample.buffer;
    }

    const gainNode = this.context.createGain();
    gainNode.gain.value = sample.settings.volume;

    // パン（ステレオポジション）
    const panNode = this.context.createStereoPanner();
    panNode.pan.value = sample.settings.pan || 0; // -1（左）〜 1（右）

    // ピッチ設定（KEYSモードでのオーバーライドも対応）
    const pitch = pitchOverride !== null ? pitchOverride : sample.settings.pitch;
    source.playbackRate.value = pitch;

    // ループ設定
    source.loop = sample.settings.loop;

    // 接続: source -> gainNode -> panNode -> masterGain
    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(this.masterGain);

    // トリム設定を適用
    const duration = sample.buffer.duration;
    const startTime = duration * sample.settings.trimStart;
    const endTime = duration * sample.settings.trimEnd;
    const playDuration = endTime - startTime;

    if (sample.settings.loop) {
      source.loopStart = startTime;
      source.loopEnd = endTime;
      source.start(0, startTime);
    } else {
      source.start(0, startTime, playDuration);
    }

    this.activeSources.set(padId, { source, gainNode, panNode });
    this.lastPlayedPad = padId;

    // 再生終了時の処理
    source.onended = () => {
      this.activeSources.delete(padId);
    };

    return { source, gainNode, panNode, duration: playDuration };
  }

  /**
   * バッファを反転（リバース用）
   */
  reverseBuffer(buffer) {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length;
    const reversedBuffer = this.context.createBuffer(numChannels, length, buffer.sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const inputData = buffer.getChannelData(channel);
      const outputData = reversedBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        outputData[i] = inputData[length - 1 - i];
      }
    }

    return reversedBuffer;
  }

  /**
   * KEYSモードで再生（音階付き）
   */
  playWithNote(padId, noteName) {
    const ratio = this.noteRatios[noteName];
    if (!ratio) return;

    // 最後に再生したサンプルを使用
    const basePadId = this.lastPlayedPad || '1';
    const sample = this.samples.get(basePadId);
    if (!sample) return;

    // 一時的に同じサンプルを別のパッドとして再生
    const tempPadId = `keys_${padId}`;
    this.samples.set(tempPadId, { ...sample });

    this.stop(tempPadId);
    return this.play(tempPadId, ratio * sample.settings.pitch);
  }

  /**
   * サンプルを停止
   */
  stop(padId) {
    const active = this.activeSources.get(padId);
    if (active) {
      try {
        active.source.stop();
      } catch (e) {
        // 既に停止している場合は無視
      }
      this.activeSources.delete(padId);
    }
  }

  /**
   * 全てのサンプルを停止
   */
  stopAll() {
    for (const [padId] of this.activeSources) {
      this.stop(padId);
    }
  }

  /**
   * サンプル設定を更新
   */
  updateSettings(padId, settings) {
    const sample = this.samples.get(padId);
    if (sample) {
      sample.settings = { ...sample.settings, ...settings };
    }
  }

  /**
   * サンプルの設定を取得
   */
  getSettings(padId) {
    const sample = this.samples.get(padId);
    return sample ? sample.settings : null;
  }

  /**
   * サンプルが存在するか確認
   */
  hasSample(padId) {
    return this.samples.has(padId);
  }

  /**
   * サンプルのバッファを取得（波形描画用）
   */
  getBuffer(padId) {
    const sample = this.samples.get(padId);
    return sample ? sample.buffer : null;
  }

  /**
   * 最後に再生したパッドIDを取得
   */
  getLastPlayedPad() {
    return this.lastPlayedPad;
  }
}

export const audioEngine = new AudioEngine();
