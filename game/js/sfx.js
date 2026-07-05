/**
 * sfx.js — WebAudio 合成音效（無外部資源）
 * 每個艦員一組音高、對話逐字音、轉場音、成就音
 */

const SFX = {
  ctx: null,
  enabled: true,

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  },

  // 使用者第一次互動時呼叫，滿足瀏覽器 autoplay 政策
  unlock() {
    this.ensureCtx();
  },

  blip(freq = 440, duration = 0.045, type = "sine", gainValue = 0.05) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  },

  // 每位艦員專屬音高（口白逐字音使用）
  crewPitch: {
    scout: 660,
    guard: 330,
    writer: 494,
    publisher: 587,
    analyst: 392
  },

  typeTick(crewId) {
    const base = this.crewPitch[crewId] || 440;
    const jitter = base + (Math.random() * 20 - 10);
    this.blip(jitter, 0.03, "square", 0.025);
  },

  transition() {
    this.blip(220, 0.12, "sine", 0.06);
    setTimeout(() => this.blip(330, 0.15, "sine", 0.05), 90);
  },

  choiceSelect() {
    this.blip(520, 0.06, "triangle", 0.05);
  },

  achievement() {
    this.blip(523, 0.1, "sine", 0.06);
    setTimeout(() => this.blip(659, 0.1, "sine", 0.06), 100);
    setTimeout(() => this.blip(784, 0.18, "sine", 0.07), 200);
  },

  crisisAlert() {
    this.blip(200, 0.08, "sawtooth", 0.05);
    setTimeout(() => this.blip(200, 0.08, "sawtooth", 0.05), 150);
  }
};

window.SFX = SFX;
