/**
 * main.js — 遊戲主流程整合
 * 開場劇情 → 艦橋 HUB → 對話場景 / 任務板 / 佔位頁 → 危機事件
 */

(function () {
  "use strict";

  const state = {
    crewData: null,
    tasksData: null,
    activeCrewId: null,
    dialogueRuntime: null, // { tree, currentNodeId, typing }
    crisisAvailableToday: false
  };

  // ---------------------------------------------------------------
  // 開場劇情：Canvas 粒子隧道
  // ---------------------------------------------------------------
  const IntroSequence = {
    canvas: null,
    ctx: null,
    stars: [],
    animId: null,
    skipped: false,

    init() {
      this.canvas = document.getElementById("intro-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.resize();
      window.addEventListener("resize", () => this.resize());
    },

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    makeStars(count) {
      const stars = [];
      for (let i = 0; i < count; i++) {
        stars.push({
          x: (Math.random() - 0.5) * this.canvas.width,
          y: (Math.random() - 0.5) * this.canvas.height,
          z: Math.random() * this.canvas.width
        });
      }
      return stars;
    },

    async play() {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const introEl = document.getElementById("scene-intro");
      introEl.classList.add("scene-active");

      if (reducedMotion) {
        // 尊重減少動態偏好：直接顯示靜態字卡、不跑粒子動畫
        document.getElementById("intro-static-fallback").classList.add("visible");
        await this.waitForSkipOrTimeout(2600);
        introEl.classList.remove("scene-active");
        return;
      }

      this.stars = this.makeStars(260);
      this.skipped = false;
      const start = performance.now();
      const DURATION = 10000;

      await new Promise((resolve) => {
        const finish = () => {
          if (this.animId) cancelAnimationFrame(this.animId);
          resolve();
        };
        const skipBtn = document.getElementById("intro-skip-btn");
        const onSkip = () => {
          this.skipped = true;
          finish();
        };
        skipBtn.addEventListener("click", onSkip, { once: true });

        const tick = (now) => {
          const elapsed = now - start;
          this.drawFrame(elapsed / DURATION);
          if (elapsed >= DURATION || this.skipped) {
            finish();
            return;
          }
          this.animId = requestAnimationFrame(tick);
        };
        this.animId = requestAnimationFrame(tick);
      });

      introEl.classList.remove("scene-active");
    },

    waitForSkipOrTimeout(ms) {
      return new Promise((resolve) => {
        const skipBtn = document.getElementById("intro-skip-btn");
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        skipBtn.addEventListener("click", finish, { once: true });
        setTimeout(finish, ms);
      });
    },

    drawFrame(progress) {
      const { ctx, canvas } = this;
      ctx.fillStyle = "rgba(10, 8, 6, 0.35)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const speed = 6 + progress * 26;

      ctx.strokeStyle = "rgba(138, 74, 42, 0.9)";
      for (const star of this.stars) {
        const prevZ = star.z;
        star.z -= speed;
        if (star.z <= 1) {
          star.x = (Math.random() - 0.5) * canvas.width;
          star.y = (Math.random() - 0.5) * canvas.height;
          star.z = canvas.width;
        }
        const k = 128;
        const sx = (star.x / star.z) * k + cx;
        const sy = (star.y / star.z) * k + cy;
        const px = (star.x / prevZ) * k + cx;
        const py = (star.y / prevZ) * k + cy;

        const size = Math.max(0.5, (1 - star.z / canvas.width) * 3);
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      // 標題字卡淡入（後段）
      const titleEl = document.getElementById("intro-title-card");
      if (progress > 0.55) {
        titleEl.classList.add("visible");
      }
    }
  };

  // ---------------------------------------------------------------
  // 艦橋 HUB
  // ---------------------------------------------------------------
  const Bridge = {
    el: null,

    init() {
      this.el = document.getElementById("scene-bridge");
      this.renderCrewRow();
      this.renderHud();
      this.bindNav();
      this.loadBridgeBackground();
    },

    loadBridgeBackground() {
      // 場景大景已就緒才套用，避免 404 造成 CSS 背景圖破圖
      // 注意：CSS url() 的相對路徑是相對於 style.css 檔案位置，
      // 這裡改用絕對 URL（相對於 document）避免路徑錯位。
      const absoluteUrl = new URL("assets/bridge-hub.png", document.baseURI).href;
      const img = new Image();
      img.onload = () => {
        document.getElementById("bridge-mid-layer").style.setProperty(
          "--bridge-image",
          `url("${absoluteUrl}")`
        );
      };
      img.onerror = () => {
        // 維持純色夜空，不強求
      };
      img.src = absoluteUrl;
    },

    renderCrewRow() {
      const row = document.getElementById("crew-row");
      row.innerHTML = "";
      state.crewData.crew.forEach((crew, idx) => {
        const btn = document.createElement("button");
        btn.className = "crew-icon-btn idle-bob";
        btn.style.animationDelay = `${idx * 0.35}s`;
        btn.setAttribute("data-crew", crew.id);
        btn.setAttribute("aria-label", crew.name);

        const img = document.createElement("img");
        img.src = crew.portraitNeutral;
        img.alt = crew.name;
        img.onerror = () => {
          img.onerror = null;
          img.src = crew.portraitFallback;
        };
        btn.appendChild(img);

        const label = document.createElement("span");
        label.className = "crew-label";
        label.textContent = crew.name;
        btn.appendChild(label);

        if (this.crewHasNewEvent(crew)) {
          const badge = document.createElement("span");
          badge.className = "exclaim-badge";
          badge.textContent = "!";
          btn.appendChild(badge);
        }

        btn.addEventListener("click", () => this.onCrewClick(crew));
        row.appendChild(btn);
      });
    },

    crewHasNewEvent(crew) {
      if (crew.id !== "guard") return false;
      // 守門員永遠值得聊：今日尚未報到，或危機事件今天還沒處理
      const notCheckedIn = !window.SaveSystem.isDailyTaskDone("daily_guard_chat");
      const crisisPending = !window.SaveSystem.isDailyTaskDone("daily_crisis");
      return notCheckedIn || crisisPending;
    },

    onCrewClick(crew) {
      window.SFX.unlock();
      if (!crew.hasDialogue) {
        Placeholder.show(crew.name, crew.placeholderNote);
        return;
      }
      DialogueScene.open(crew);
    },

    renderHud() {
      const s = window.SaveSystem.load();
      document.getElementById("hud-rank").textContent = s.profile.rank;
      document.getElementById("hud-streak").textContent = s.streak.count;
      document.getElementById("hud-xp").textContent = s.xp.total;
    },

    bindNav() {
      document.getElementById("nav-tasks-btn").addEventListener("click", () => {
        window.SFX.unlock();
        TaskBoard.open();
      });
      document.querySelectorAll("[data-placeholder-nav]").forEach((el) => {
        el.addEventListener("click", () => {
          window.SFX.unlock();
          const label = el.getAttribute("data-placeholder-nav");
          const note = el.getAttribute("data-placeholder-note");
          Placeholder.show(label, note);
        });
      });
    },

    refreshHud() {
      this.renderHud();
      this.renderCrewRow();
    }
  };

  // ---------------------------------------------------------------
  // 佔位頁（範圍外功能誠實標示）
  // ---------------------------------------------------------------
  const Placeholder = {
    show(title, note) {
      document.getElementById("placeholder-title").textContent = title;
      document.getElementById("placeholder-note").textContent =
        note || "訊號還在路上——這個區域尚未開放";
      window.SceneManager.transitionTo("placeholder", title);
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("placeholder-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.SceneManager.transitionTo("bridge", "艦橋");
        Bridge.refreshHud();
      });
    }
  });

  // ---------------------------------------------------------------
  // 對話場景（守門員一般對話 + 危機事件共用渲染器）
  // ---------------------------------------------------------------
  const DialogueScene = {
    async open(crew) {
      const tree = await window.DialogueEngine.loadTree(crew.dialogueFile);
      state.activeCrewId = crew.id;
      await window.SceneManager.transitionTo("dialogue", crew.name);
      this.setupPortrait(crew);
      const flags = window.SaveSystem.load().flags;
      const startNodeId = window.DialogueEngine.resolveStart(tree, flags);
      state.dialogueRuntime = { tree, crew };
      this.renderNode(tree, startNodeId);

      // 標記今日已與守門員互動
      if (window.SaveSystem.markDailyTaskDone("daily_guard_chat")) {
        window.SaveSystem.addXP(20, "daily_guard_chat");
      }
    },

    async openCrisis(crew) {
      const tree = await window.DialogueEngine.loadTree(crew.dialogueFile);
      const crisisTree = { start: tree.crisisEvent.start, nodes: tree.crisisEvent.nodes };
      state.activeCrewId = crew.id;
      window.SFX.crisisAlert();
      await window.SceneManager.transitionTo("dialogue", "危機事件");
      this.setupPortrait(crew);
      state.dialogueRuntime = { tree: crisisTree, crew };
      this.renderNode(crisisTree, crisisTree.start);
    },

    setupPortrait(crew) {
      const img = document.getElementById("dialogue-portrait");
      img.src = crew.portraitNeutral;
      img.onerror = () => {
        img.onerror = null;
        img.src = crew.portraitFallback;
      };
      document.getElementById("dialogue-speaker-name").textContent = crew.name;
    },

    updatePortraitExpression(expression, crew) {
      const img = document.getElementById("dialogue-portrait");
      if (expression === "pleased" && crew.portraitPleased) {
        img.onerror = () => {
          img.onerror = null;
          img.src = crew.portraitFallback;
        };
        img.src = crew.portraitPleased;
      } else {
        img.onerror = () => {
          img.onerror = null;
          img.src = crew.portraitFallback;
        };
        img.src = crew.portraitNeutral;
      }
    },

    renderNode(tree, nodeId) {
      const node = window.DialogueEngine.getNode(tree, nodeId);
      if (!node || node.type === "end") {
        this.endDialogue();
        return;
      }

      window.DialogueEngine.applyNodeEffects(node);
      const crew = state.dialogueRuntime.crew;
      this.updatePortraitExpression(node.expression, crew);

      const linesText = (node.lines || []).join("　");
      this.typeLines(linesText, () => {
        this.renderChoices(tree, node.choices || []);
      });

      Bridge.renderHud();
    },

    _typingTimer: null,
    typeLines(text, onDone) {
      const el = document.getElementById("dialogue-text");
      const choicesEl = document.getElementById("dialogue-choices");
      choicesEl.innerHTML = "";
      el.textContent = "";
      if (this._typingTimer) clearInterval(this._typingTimer);

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        el.textContent = text;
        onDone();
        return;
      }

      let i = 0;
      const crewId = state.activeCrewId;
      this._typingTimer = setInterval(() => {
        el.textContent = text.slice(0, i + 1);
        if (i % 2 === 0) window.SFX.typeTick(crewId);
        i++;
        if (i >= text.length) {
          clearInterval(this._typingTimer);
          this._typingTimer = null;
          onDone();
        }
      }, 38);

      // 允許點擊對話框直接跳過逐字
      const skipHandler = () => {
        if (this._typingTimer) {
          clearInterval(this._typingTimer);
          this._typingTimer = null;
          el.textContent = text;
          onDone();
        }
      };
      el.onclick = skipHandler;
    },

    renderChoices(tree, choices) {
      const choicesEl = document.getElementById("dialogue-choices");
      choicesEl.innerHTML = "";
      choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.className = "dialogue-choice-btn";
        btn.textContent = choice.text;
        btn.addEventListener("click", () => {
          window.SFX.choiceSelect();
          if (choice.setFlags) {
            for (const [k, v] of Object.entries(choice.setFlags)) {
              window.SaveSystem.applyFlagOp(k, v);
            }
          }
          this.renderNode(tree, choice.goto);
        });
        choicesEl.appendChild(btn);
      });
    },

    async endDialogue() {
      await window.SceneManager.transitionTo("bridge", "艦橋");
      Bridge.refreshHud();
    }
  };

  // ---------------------------------------------------------------
  // 任務板
  // ---------------------------------------------------------------
  const TaskBoard = {
    async open() {
      await window.SceneManager.transitionTo("tasks", "今日任務");
      this.render();
    },

    render() {
      const listEl = document.getElementById("task-list");
      listEl.innerHTML = "";

      document.getElementById("task-demo-notice").textContent = state.tasksData.demoNotice;

      state.tasksData.dailyTasks.forEach((task) => {
        const li = document.createElement("li");
        li.className = "task-item";
        const done = window.SaveSystem.isDailyTaskDone(task.id);
        if (done) li.classList.add("task-done");

        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = `${done ? "✓ " : ""}${task.title}`;
        li.appendChild(title);

        const desc = document.createElement("div");
        desc.className = "task-desc";
        desc.textContent = task.description;
        li.appendChild(desc);

        const xp = document.createElement("div");
        xp.className = "task-xp";
        xp.textContent = `+${task.xp} XP`;
        li.appendChild(xp);

        if (task.id === "daily_checkin" && !done) {
          const btn = document.createElement("button");
          btn.className = "task-action-btn";
          btn.textContent = "簽到";
          btn.addEventListener("click", () => {
            const result = window.SaveSystem.checkinToday();
            if (window.SaveSystem.markDailyTaskDone("daily_checkin")) {
              window.SaveSystem.addXP(task.xp, "daily_checkin");
            }
            window.SFX.achievement();
            this.render();
            Bridge.refreshHud();
          });
          li.appendChild(btn);
        }

        if (task.id === "daily_crisis") {
          const btn = document.createElement("button");
          btn.className = "task-action-btn";
          btn.textContent = done ? "已處理" : state.crisisAvailableToday ? "前往處理" : "尚未觸發";
          btn.disabled = done || !state.crisisAvailableToday;
          btn.addEventListener("click", async () => {
            const guardCrew = state.crewData.crew.find((c) => c.id === "guard");
            await this.close();
            await DialogueScene.openCrisis(guardCrew);
            if (window.SaveSystem.markDailyTaskDone("daily_crisis")) {
              // reward xp 已由對話樹的 reward 節點處理，這裡不重複加
            }
          });
          li.appendChild(btn);
        }

        listEl.appendChild(li);
      });

      const boardsEl = document.getElementById("placeholder-boards-list");
      boardsEl.innerHTML = "";
      state.tasksData.placeholderBoards.forEach((b) => {
        const li = document.createElement("li");
        li.textContent = `${b.label}——${b.note}`;
        boardsEl.appendChild(li);
      });
    },

    async close() {
      await window.SceneManager.transitionTo("bridge", "艦橋");
      Bridge.refreshHud();
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    const backBtn = document.getElementById("task-back-btn");
    if (backBtn) backBtn.addEventListener("click", () => TaskBoard.close());
  });

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------
  async function boot() {
    window.SceneManager.init();
    IntroSequence.init();

    const [crewData, tasksData] = await Promise.all([
      fetch("data/crew.json").then((r) => r.json()),
      fetch("data/tasks.json").then((r) => r.json())
    ]);
    state.crewData = crewData;
    state.tasksData = tasksData;

    // 危機事件：示範模式下，每日登艦後隨機開放（示範用固定觸發，確保可驗收）
    state.crisisAvailableToday = !window.SaveSystem.isDailyTaskDone("daily_crisis");

    Bridge.init();

    const save = window.SaveSystem.load();
    if (!save.profile.hasSeenIntro) {
      await IntroSequence.play();
      window.SaveSystem.markIntroSeen();
    }

    await window.SceneManager.transitionTo("bridge", "艦橋");
    Bridge.refreshHud();
  }

  document.addEventListener("DOMContentLoaded", () => {
    boot().catch((e) => {
      console.error("[main.js] boot 失敗", e);
    });
  });

  // debug/testing hook（供驗收時在 console 重播開場）
  window.__fleetDebug = {
    replayIntro: () => IntroSequence.play(),
    state
  };
})();
