/**
 * Hakata Sampler - Sequencer
 * 16ステップシーケンサー + スイング + パターン保存
 */

export class Sequencer {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.bpm = 120;
        this.steps = 16;
        this.currentStep = 0;
        this.isPlaying = false;
        this.pattern = {}; // { padId: [step indices] }
        this.intervalId = null;
        this.onStepChange = null;

        // 新機能
        this.swing = 0; // 0-100%
        this.savedPatterns = [null, null, null, null]; // 4つのパターンスロット
        this.currentPatternSlot = 0;

        // タップテンポ
        this.tapTimes = [];
        this.lastTapTime = 0;
    }

    /**
     * BPMを設定
     */
    setBpm(bpm) {
        this.bpm = Math.max(40, Math.min(300, bpm));
        if (this.isPlaying) {
            this.stop();
            this.start();
        }
    }

    /**
     * スイング量を設定 (0-100)
     */
    setSwing(value) {
        this.swing = Math.max(0, Math.min(100, value));
    }

    /**
     * タップテンポ
     */
    tap() {
        const now = performance.now();

        // 2秒以上経過していたらリセット
        if (now - this.lastTapTime > 2000) {
            this.tapTimes = [];
        }

        this.tapTimes.push(now);
        this.lastTapTime = now;

        // 最低2回タップが必要
        if (this.tapTimes.length >= 2) {
            // 直近4回のタップから平均BPMを計算
            const recentTaps = this.tapTimes.slice(-4);
            let totalInterval = 0;
            for (let i = 1; i < recentTaps.length; i++) {
                totalInterval += recentTaps[i] - recentTaps[i - 1];
            }
            const avgInterval = totalInterval / (recentTaps.length - 1);
            const newBpm = Math.round(60000 / avgInterval);
            this.setBpm(newBpm);
            return newBpm;
        }
        return this.bpm;
    }

    /**
     * ステップをトグル
     */
    toggleStep(padId, step) {
        if (!this.pattern[padId]) {
            this.pattern[padId] = [];
        }

        const index = this.pattern[padId].indexOf(step);
        if (index === -1) {
            this.pattern[padId].push(step);
        } else {
            this.pattern[padId].splice(index, 1);
        }
    }

    /**
     * ステップがアクティブか確認
     */
    isStepActive(padId, step) {
        return this.pattern[padId]?.includes(step) || false;
    }

    /**
     * 再生開始
     */
    start() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.currentStep = 0;
        this.scheduleNextStep();
    }

    /**
     * 次のステップをスケジュール（スイング対応）
     */
    scheduleNextStep() {
        if (!this.isPlaying) return;

        // 基本の16分音符の間隔 (ms)
        const baseStepDuration = (60 / this.bpm) * 1000 / 4;

        // スイング: 偶数ステップ（裏拍）を遅らせる
        let stepDuration = baseStepDuration;
        if (this.currentStep % 2 === 1 && this.swing > 0) {
            // 裏拍を遅らせる（スイング量に応じて最大50%遅延）
            const swingDelay = baseStepDuration * (this.swing / 100) * 0.5;
            stepDuration = baseStepDuration + swingDelay;
        } else if (this.currentStep % 2 === 0 && this.swing > 0) {
            // 表拍は早める
            const swingAdvance = baseStepDuration * (this.swing / 100) * 0.5;
            stepDuration = baseStepDuration - swingAdvance;
        }

        this.intervalId = setTimeout(() => {
            this.tick();
            this.scheduleNextStep();
        }, Math.max(stepDuration, 10));
    }

    /**
     * 停止
     */
    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
        this.currentStep = 0;

        if (this.onStepChange) {
            this.onStepChange(this.currentStep);
        }
    }

    /**
     * 1ステップ進める
     */
    tick() {
        // 現在のステップでアクティブなパッドを再生
        for (const [padId, steps] of Object.entries(this.pattern)) {
            if (steps.includes(this.currentStep)) {
                this.audioEngine.play(padId);
            }
        }

        if (this.onStepChange) {
            this.onStepChange(this.currentStep);
        }

        // 次のステップへ
        this.currentStep = (this.currentStep + 1) % this.steps;
    }

    /**
     * パターンをクリア
     */
    clearPattern() {
        this.pattern = {};
    }

    /**
     * パターンを取得
     */
    getPattern() {
        return { ...this.pattern };
    }

    /**
     * パターンを設定
     */
    setPattern(pattern) {
        this.pattern = { ...pattern };
    }

    /**
     * 現在のパターンをスロットに保存
     */
    savePattern(slot) {
        if (slot >= 0 && slot < 4) {
            this.savedPatterns[slot] = JSON.parse(JSON.stringify(this.pattern));
            this.currentPatternSlot = slot;
        }
    }

    /**
     * スロットからパターンをロード
     */
    loadPattern(slot) {
        if (slot >= 0 && slot < 4 && this.savedPatterns[slot]) {
            this.pattern = JSON.parse(JSON.stringify(this.savedPatterns[slot]));
            this.currentPatternSlot = slot;
            return true;
        }
        return false;
    }

    /**
     * パターンスロットが保存済みか確認
     */
    isPatternSaved(slot) {
        return this.savedPatterns[slot] !== null;
    }
}

