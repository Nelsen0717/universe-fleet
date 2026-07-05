/**
 * scene-manager.js — 場景制切換 + 黑幕字卡轉場
 * 場景是 DOM 節點（.scene），切換時淡出→黑幕字卡→淡入
 */

const SceneManager = {
  root: null,
  cardEl: null,
  cardTextEl: null,
  current: null,
  reducedMotion: false,

  init() {
    this.root = document.getElementById("scene-root");
    this.cardEl = document.getElementById("transition-card");
    this.cardTextEl = document.getElementById("transition-card-text");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  getScene(id) {
    return document.getElementById(`scene-${id}`);
  },

  showImmediate(id) {
    document.querySelectorAll(".scene").forEach((el) => el.classList.remove("scene-active"));
    const el = this.getScene(id);
    if (el) el.classList.add("scene-active");
    this.current = id;
  },

  /**
   * 場景轉換：黑幕淡入 → 顯示字卡文字 → 切換場景 DOM → 黑幕淡出
   */
  async transitionTo(id, cardText) {
    if (window.SFX) window.SFX.transition();

    if (this.reducedMotion) {
      this.showImmediate(id);
      return;
    }

    this.cardTextEl.textContent = cardText || "";
    this.cardEl.classList.add("card-visible");
    await this._wait(400);
    this.showImmediate(id);
    await this._wait(500);
    this.cardEl.classList.remove("card-visible");
    await this._wait(400);
  },

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

window.SceneManager = SceneManager;
