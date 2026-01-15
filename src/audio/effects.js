/**
 * Hakata Sampler - Effects Engine
 * マスターエフェクト処理
 */

export class EffectsEngine {
    constructor(audioContext) {
        this.context = audioContext;
        this.effects = {};
        this.isInitialized = false;
    }

    init(masterGain) {
        if (this.isInitialized) return;

        // リバーブ
        this.effects.reverb = this.createReverb();
        this.effects.reverbGain = this.context.createGain();
        this.effects.reverbGain.gain.value = 0;

        // ディレイ
        this.effects.delay = this.context.createDelay(1.0);
        this.effects.delay.delayTime.value = 0.3;
        this.effects.delayFeedback = this.context.createGain();
        this.effects.delayFeedback.gain.value = 0.4;
        this.effects.delayGain = this.context.createGain();
        this.effects.delayGain.gain.value = 0;

        // フィルター
        this.effects.filter = this.context.createBiquadFilter();
        this.effects.filter.type = 'lowpass';
        this.effects.filter.frequency.value = 20000;
        this.effects.filter.Q.value = 1;

        // 接続: masterGain -> filter -> destination
        //                 -> reverb -> reverbGain -> destination
        //                 -> delay -> delayFeedback -> delay
        //                         -> delayGain -> destination

        masterGain.disconnect();
        masterGain.connect(this.effects.filter);

        // フィルターから出力
        this.effects.filter.connect(this.context.destination);

        // リバーブセンド
        this.effects.filter.connect(this.effects.reverb);
        this.effects.reverb.connect(this.effects.reverbGain);
        this.effects.reverbGain.connect(this.context.destination);

        // ディレイセンド
        this.effects.filter.connect(this.effects.delay);
        this.effects.delay.connect(this.effects.delayFeedback);
        this.effects.delayFeedback.connect(this.effects.delay);
        this.effects.delay.connect(this.effects.delayGain);
        this.effects.delayGain.connect(this.context.destination);

        this.isInitialized = true;
    }

    createReverb() {
        const convolver = this.context.createConvolver();
        const rate = this.context.sampleRate;
        const length = rate * 2; // 2秒のリバーブ
        const impulse = this.context.createBuffer(2, length, rate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        convolver.buffer = impulse;
        return convolver;
    }

    setReverbAmount(value) {
        // 0-1の範囲
        if (this.effects.reverbGain) {
            this.effects.reverbGain.gain.value = value * 0.5;
        }
    }

    setDelayAmount(value) {
        if (this.effects.delayGain) {
            this.effects.delayGain.gain.value = value * 0.6;
        }
    }

    setDelayTime(value) {
        // 0.05 - 1.0秒
        if (this.effects.delay) {
            this.effects.delay.delayTime.value = 0.05 + value * 0.95;
        }
    }

    setFilterFrequency(value) {
        // 100 - 20000 Hz (カットオフ)
        if (this.effects.filter) {
            const minFreq = 100;
            const maxFreq = 20000;
            const freq = minFreq * Math.pow(maxFreq / minFreq, value);
            this.effects.filter.frequency.value = freq;
        }
    }

    setFilterResonance(value) {
        if (this.effects.filter) {
            this.effects.filter.Q.value = 0.5 + value * 15;
        }
    }
}
