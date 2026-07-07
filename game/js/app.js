/* 課前裝備發放 v4 —「暗艦點燈」單檔邏輯
 * 骨架繼承 v3（一字不動）：
 *   單一狀態源 localStorage['fleetOnboard.v2']（新增 litSystems[]）
 *   帶鎖轉場（transition token，轉場中鎖輸入、連點不壞）
 *   計時器歸場景（每場景 teardown 清自己的 timers）
 *   通關碼機制、白名單五連結、回訪續關
 * 新增（v4 皮與血）：
 *   艦橋點燈（litSystems）、通訊視窗打字機、聲音分層（環境嗡鳴疊層）、
 *   星窗視差 canvas、完成儀式掃描動畫、卡關 90 秒鼓勵
 */
(function () {
  "use strict";

  var STORAGE_KEY = "fleetOnboard.v2";
  var QUESTS_URL = "data/install-quests.json";
  var REDUCE_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------- 狀態 ----------------
  var state = {
    name: "",
    currentQuest: 0, // 尚未完成的下一關 index
    done: [],
    seenOpening: false,
    litSystems: [], // 已點亮的艦橋系統（quest id 清單）
  };
  var questData = null; // { unlockCode, quests: [...] }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.name = typeof parsed.name === "string" ? parsed.name : "";
        state.currentQuest = Number.isInteger(parsed.currentQuest) ? parsed.currentQuest : 0;
        state.done = Array.isArray(parsed.done) ? parsed.done : [];
        state.seenOpening = !!parsed.seenOpening;
        state.litSystems = Array.isArray(parsed.litSystems) ? parsed.litSystems : [];
      }
    } catch (e) {
      // 壞資料當全新開始，不阻斷流程
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 存不進去（無痕模式等）不阻斷流程
    }
  }

  // ---------------- 場景管理（單一職責、鎖輸入、teardown 契約） ----------------
  var sceneManager = (function () {
    var transitionToken = 0;
    var transitioning = false;
    var currentScene = null;
    var sceneTimers = []; // 當前場景的計時器

    function el(id) {
      return document.getElementById(id);
    }

    function registerTimer(id) {
      sceneTimers.push(id);
      return id;
    }

    function clearSceneTimers() {
      sceneTimers.forEach(function (id) {
        clearTimeout(id);
        clearInterval(id);
      });
      sceneTimers = [];
    }

    function hideAllScenes() {
      var scenes = document.querySelectorAll(".scene");
      scenes.forEach(function (s) {
        s.classList.remove("scene-active");
      });
    }

    // 顯示轉場字卡（含無線電雜訊）→ 切場景 → 隱藏字卡。帶 token，避免連點造成疊加轉場。
    function goTo(sceneId, opts) {
      opts = opts || {};
      var myToken = ++transitionToken;
      transitioning = true;
      lockInput(true);

      var cardText = opts.cardText || "";
      var card = el("transition-card");
      var cardTextEl = el("transition-card-text");
      cardTextEl.textContent = cardText;
      card.classList.add("card-visible");
      sfx.staticNoise();
      playStaticVisual();

      var showDelay = cardText ? 550 : 200;

      var t1 = setTimeout(function () {
        if (myToken !== transitionToken) return; // 有更新的轉場插隊，這次作廢
        clearSceneTimers(); // 離場：清掉上一場景所有計時器
        hideAllScenes();
        var target = el(sceneId);
        if (target) target.classList.add("scene-active");
        currentScene = sceneId;

        var t2 = setTimeout(function () {
          if (myToken !== transitionToken) return;
          card.classList.remove("card-visible");
          transitioning = false;
          lockInput(false);
          if (typeof opts.onEnter === "function") opts.onEnter();
        }, 260);
        registerTimer(t2);
      }, showDelay);
      registerTimer(t1);
    }

    function lockInput(locked) {
      document.body.style.pointerEvents = locked ? "none" : "";
      var muteBtn = el("mute-btn");
      if (muteBtn) muteBtn.style.pointerEvents = "all"; // 靜音鍵永遠可按
    }

    function isTransitioning() {
      return transitioning;
    }

    function setTimer(fn, ms) {
      var id = setTimeout(fn, ms);
      return registerTimer(id);
    }

    function setInterval_(fn, ms) {
      var id = setInterval(fn, ms);
      return registerTimer(id);
    }

    return {
      goTo: goTo,
      isTransitioning: isTransitioning,
      setTimer: setTimer,
      setInterval: setInterval_,
      el: el,
      currentScene: function () {
        return currentScene;
      },
    };
  })();

  // ---------------- 聲音（WebAudio 合成、無音檔、分層） ----------------
  var sfx = (function () {
    var muted = false;
    try {
      muted = localStorage.getItem("fleetOnboard.muted") === "1";
    } catch (e) {}
    var ctx = null;
    var droneLayers = []; // 環境嗡鳴：每點亮一關疊一層

    function getCtx() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      return ctx;
    }

    function resume() {
      var ac = getCtx();
      if (ac && ac.state === "suspended") ac.resume();
    }

    function tone(freqs, dur, type) {
      if (muted) return;
      var ac = getCtx();
      if (!ac) return;
      resume();
      var now = ac.currentTime;
      freqs.forEach(function (f, i) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = type || "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(gain).connect(ac.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + dur + i * 0.05 + 0.05);
      });
    }

    // 環境層：低頻艦橋嗡鳴，常駐。每點亮一關疊厚一層（gain 疊加）。
    function ensureDroneLayer(index, freq, targetGain) {
      var ac = getCtx();
      if (!ac) return;
      if (droneLayers[index]) {
        if (!muted) {
          droneLayers[index].gain.gain.linearRampToValueAtTime(targetGain, ac.currentTime + 1.2);
        }
        return;
      }
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      droneLayers[index] = { osc: osc, gain: gain, target: targetGain };
      if (!muted) {
        gain.gain.linearRampToValueAtTime(targetGain, ac.currentTime + 1.6);
      }
    }

    // 依已點亮系統數量（0-5）設定嗡鳴厚度：每層一個泛音、疊加更厚
    function setDroneThickness(litCount) {
      resume();
      var baseFreqs = [55, 82.5, 110, 138, 165]; // A1 泛音列，越疊越厚但和諧
      for (var i = 0; i < baseFreqs.length; i++) {
        var shouldPlay = i <= litCount; // 至少一層常駐（待命嗡鳴）
        ensureDroneLayer(i, baseFreqs[i], shouldPlay ? 0.02 + i * 0.006 : 0.0001);
      }
    }

    function applyMuteToDrones() {
      var ac = getCtx();
      if (!ac) return;
      droneLayers.forEach(function (layer) {
        if (!layer) return;
        var target = muted ? 0.0001 : layer.target;
        layer.gain.gain.linearRampToValueAtTime(target, ac.currentTime + 0.3);
      });
    }

    // 無線電雜訊過場：白噪音短爆
    function staticNoise() {
      if (muted) return;
      var ac = getCtx();
      if (!ac) return;
      resume();
      var dur = 0.4;
      var bufferSize = Math.floor(ac.sampleRate * dur);
      var buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      var src = ac.createBufferSource();
      src.buffer = buffer;
      var gain = ac.createGain();
      var filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0.06, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      src.connect(filter).connect(gain).connect(ac.destination);
      src.start();
    }

    return {
      stamp: function () { tone([220, 110], 0.18, "square"); }, // 蓋章：低沉短音
      key: function () { tone([740], 0.05, "square"); }, // 按鍵短嗶
      copy: function () { tone([520, 780], 0.1, "square"); }, // 複製「喀」
      complete: function () { tone([523, 659, 784], 0.45, "sine"); }, // 系統點亮：上升和弦
      relay: function () { tone([300], 0.12, "square"); }, // 繼電器「咚」
      fleetAwaken: function () { tone([392, 494, 587, 659], 0.9, "sine"); }, // 全艦甦醒：和弦
      commOpen: function () { tone([880, 660], 0.1, "sine"); }, // 通訊開頭音
      staticNoise: staticNoise,
      setDroneThickness: setDroneThickness,
      toggleMute: function () {
        muted = !muted;
        try {
          localStorage.setItem("fleetOnboard.muted", muted ? "1" : "0");
        } catch (e) {}
        applyMuteToDrones();
        return muted;
      },
      isMuted: function () {
        return muted;
      },
    };
  })();

  // 轉場雜訊視覺（canvas 短暫閃噪點）
  function playStaticVisual() {
    var canvas = sceneManager.el("static-noise");
    if (!canvas) return;
    canvas.classList.remove("noise-visible");
    void canvas.offsetWidth; // 強制 reflow 讓動畫重播
    canvas.classList.add("noise-visible");
    if (REDUCE_MOTION) return;
    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    canvas.width = window.innerWidth || document.documentElement.clientWidth || 1;
    canvas.height = window.innerHeight || document.documentElement.clientHeight || 1;
    if (!canvas.width || !canvas.height) return; // 防禦：極早期佈局未就緒時直接跳過這次雜訊視覺
    var frames = 0;
    var maxFrames = 6;
    function drawFrame() {
      frames++;
      var imgData = ctx2d.createImageData(canvas.width, canvas.height);
      for (var i = 0; i < imgData.data.length; i += 4) {
        var v = Math.random() * 255;
        imgData.data[i] = v;
        imgData.data[i + 1] = v;
        imgData.data[i + 2] = v;
        imgData.data[i + 3] = 255;
      }
      ctx2d.putImageData(imgData, 0, 0);
      if (frames < maxFrames) {
        setTimeout(drawFrame, 80);
      } else {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    drawFrame();
  }

  // ---------------- 靜音鍵 ----------------
  function initMuteButton() {
    var btn = sceneManager.el("mute-btn");
    if (!btn) return;
    function render() {
      btn.textContent = sfx.isMuted() ? "🔇" : "🔊";
    }
    render();
    btn.onclick = function () {
      sfx.toggleMute();
      render();
    };
  }

  // ---------------- 星窗深空視差（常駐背景） ----------------
  function initStarfield() {
    var canvas = sceneManager.el("starfield");
    if (!canvas || !canvas.getContext) return;
    var ctx2d = canvas.getContext("2d");
    var stars = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function makeStars() {
      var count = Math.round((canvas.width * canvas.height) / 6000);
      stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.3 + 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: 0.0005 + Math.random() * 0.0007,
          driftSpeed: 0.004 + Math.random() * 0.008,
          hueAmber: Math.random() < 0.12, // 少數星點帶琥珀色，呼應儀表光
        });
      }
    }

    function draw(t) {
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(function (s) {
        var twinkle = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx2d.globalAlpha = twinkle;
        ctx2d.fillStyle = s.hueAmber ? "#e8a34c" : "#cfe0f0";
        ctx2d.beginPath();
        ctx2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx2d.fill();
        // 極緩慢視差飄移
        s.y += s.driftSpeed * 0.02;
        if (s.y > canvas.height) s.y = 0;
      });
      ctx2d.globalAlpha = 1;
      if (!REDUCE_MOTION) requestAnimationFrame(draw);
    }

    resize();
    makeStars();
    window.addEventListener("resize", function () {
      resize();
      makeStars();
    });

    if (REDUCE_MOTION) {
      draw(0);
    } else {
      requestAnimationFrame(draw);
    }
  }

  // ---------------- 艦橋系統點燈渲染 ----------------
  var SYSTEM_COUNT = 5;

  function renderBridgeSystems(containerId) {
    var wrap = sceneManager.el(containerId);
    if (!wrap) return;
    wrap.innerHTML = "";
    for (var i = 0; i < SYSTEM_COUNT; i++) {
      var dot = document.createElement("div");
      dot.className = "bridge-system-dot" + (i < state.litSystems.length ? " lit" : "");
      wrap.appendChild(dot);
    }
  }

  function litCaption(containerParent) {
    var caption = containerParent.querySelector(".bridge-caption");
    if (!caption) return;
    if (state.litSystems.length === 0) {
      caption.textContent = "艦橋系統：待命中";
    } else if (state.litSystems.length >= SYSTEM_COUNT) {
      caption.textContent = "艦橋系統：全部就位";
    } else {
      caption.textContent = "艦橋系統：" + state.litSystems.length + "／" + SYSTEM_COUNT + " 已點亮";
    }
  }

  function refreshCoverBridge() {
    renderBridgeSystems("bridge-systems-cover");
    var panorama = sceneManager.el("scene-cover").querySelector(".bridge-panorama");
    if (panorama) litCaption(panorama);
  }

  // ---------------- 通訊視窗打字機 ----------------
  function typeInto(el, text, opts) {
    opts = opts || {};
    el.textContent = "";
    var caret = document.createElement("span");
    caret.className = "caret";
    el.appendChild(caret);
    var i = 0;
    var speed = opts.speed || 26;
    function step() {
      if (i >= text.length) {
        caret.remove();
        if (typeof opts.onDone === "function") opts.onDone();
        return;
      }
      caret.insertAdjacentText("beforebegin", text.charAt(i));
      i++;
      sceneManager.setTimer(step, speed);
    }
    step();
  }

  // ---------------- 老師三句開場 ----------------
  var MENTOR_INTRO_LINES = [
    "歡迎上艦、艦長。",
    "接下來一關一關來、玩完你電腦上就有一支真的 AI 團隊——開課那天帶著它來。",
    "先說老實話：等一下會用到電腦裡的『終端機』。不用怕、每一步都有圖、我全程都在。大約 30-45 分鐘、隨時可以休息、進度我記著。",
  ];

  // ---------------- 資料載入 ----------------
  // 呼叫載入完成 callback 的統一包裝：cb 內部（showCover / sceneManager.goTo /
  // playStaticVisual …）若同步拋例外，必須自成一格、附獨立標籤並重拋，
  // 絕不能被上游 fetch 的 .catch 誤吞成「讀取失敗」、掩蓋真正的錯誤來源。
  function invokeLoadCallback(label, run) {
    try {
      run();
    } catch (e) {
      console.error("[fleet] " + label + "就緒、但初始化畫面時發生例外（非讀取失敗）", e);
      throw e; // 保留原始 stack、讓真正的錯誤來源浮上來
    }
  }

  function loadQuestData(cb) {
    if (questData) {
      invokeLoadCallback("關卡資料", function () {
        cb(questData);
      });
      return;
    }
    fetch(QUESTS_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("quest data fetch failed: " + r.status);
        return r.json();
      })
      .then(function (data) {
        questData = data;
        return data;
      })
      .catch(function (err) {
        console.error("[fleet] 讀取關卡資料失敗", err);
        // 降級：給空清單，至少不讓畫面整個死掉
        questData = { unlockCode: "", quests: [] };
        return questData;
      })
      .then(function (data) {
        // cb 的例外走 invokeLoadCallback、不被上面 fetch 的 .catch 誤吞
        invokeLoadCallback("關卡資料", function () {
          cb(data);
        });
      });
  }

  // ---------------- 畫面渲染：各場景 ----------------
  function renderGuideBar() {
    var bar = sceneManager.el("guide-bar");
    if (state.currentQuest >= questData.quests.length) {
      bar.classList.add("guide-bar-hidden");
      return;
    }
    var q = questData.quests[state.currentQuest];
    sceneManager.el("guide-bar-label").textContent =
      "第 " + (state.currentQuest + 1) + "／" + questData.quests.length + " 關・" + stripEmoji(q.title);
    sceneManager.el("guide-bar-continue-btn").onclick = function () {
      if (sceneManager.isTransitioning()) return;
      if (sceneManager.currentScene() === "scene-quest") return; // 已在關卡中、按了不跳
      goToQuest(state.currentQuest);
    };
    bar.classList.remove("guide-bar-hidden");
  }

  function stripEmoji(text) {
    return text.replace(/^[^一-龥A-Za-z0-9]+/, "").trim();
  }

  function showCover() {
    sceneManager.goTo("scene-cover", {
      onEnter: function () {
        refreshCoverBridge();
        sfx.setDroneThickness(state.litSystems.length);
        // 注意：計時器必須在 onEnter（進場完成後）才註冊，
        // 否則會被 goTo 自己轉場流程的 clearSceneTimers() 提前清掉。
        sceneManager.setTimer(function () {
          startOrdersOrResume();
        }, 3000);
      },
    });
  }

  function startOrdersOrResume() {
    if (state.seenOpening && state.name) {
      // 回訪：老師「上次到第 X 關、繼續？」
      resumeFlow();
    } else {
      showOrders();
    }
  }

  function showOrders() {
    sceneManager.goTo("scene-orders", {
      cardText: "任命書",
      onEnter: function () {
        var input = sceneManager.el("orders-name-input");
        var btn = sceneManager.el("orders-stamp-btn");
        var stamp = sceneManager.el("orders-stamp");
        input.value = state.name || "";
        stamp.textContent = "未蓋章";
        stamp.classList.add("orders-stamp-pending");

        input.oninput = function () { sfx.key(); };

        btn.onclick = function () {
          var name = input.value.trim().replace(/艦長/g, "").trim();
          if (!name) {
            input.focus();
            return;
          }
          state.name = name;
          saveState();
          stamp.textContent = "已蓋章";
          stamp.classList.remove("orders-stamp-pending");
          sfx.stamp();
          sceneManager.setTimer(function () {
            showMentorIntro(0);
          }, 500);
        };
      },
    });
  }

  function showMentorIntro(lineIndex) {
    sceneManager.goTo("scene-mentor-intro", {
      onEnter: function () {
        var lineEl = sceneManager.el("mentor-intro-line");
        var btn = sceneManager.el("mentor-intro-next-btn");
        sfx.commOpen();
        typeInto(lineEl, MENTOR_INTRO_LINES[lineIndex]);
        btn.textContent = lineIndex < MENTOR_INTRO_LINES.length - 1 ? "繼續" : "開始裝備發放";
        btn.onclick = function () {
          if (sceneManager.isTransitioning()) return;
          sfx.key();
          if (lineIndex < MENTOR_INTRO_LINES.length - 1) {
            showMentorIntro(lineIndex + 1);
          } else {
            state.seenOpening = true;
            saveState();
            goToQuest(state.currentQuest);
          }
        };
      },
    });
  }

  function resumeFlow() {
    if (state.currentQuest >= questData.quests.length) {
      showCelebrationOrCertificate();
      return;
    }
    sceneManager.goTo("scene-mentor-intro", {
      cardText: "歡迎回來",
      onEnter: function () {
        var lineEl = sceneManager.el("mentor-intro-line");
        var btn = sceneManager.el("mentor-intro-next-btn");
        var q = questData.quests[state.currentQuest];
        sfx.commOpen();
        typeInto(
          lineEl,
          "艦長" + state.name + "，上次到第 " + (state.currentQuest + 1) + " 關・" + stripEmoji(q.title) + "，繼續？"
        );
        btn.textContent = "繼續";
        btn.onclick = function () {
          if (sceneManager.isTransitioning()) return;
          goToQuest(state.currentQuest);
        };
      },
    });
  }

  // 依 actionType 產生三件套「畫面模擬」DOM（高擬真 os-window）
  function renderSimDom(q, container) {
    container.innerHTML = "";
    if (q.actionType === "download") {
      var browserWin = document.createElement("div");
      browserWin.className = "os-window browser-window";
      browserWin.innerHTML =
        '<div class="os-titlebar">' +
        '<span class="os-dot red"></span><span class="os-dot yellow"></span><span class="os-dot green"></span>' +
        '<span class="browser-addressbar"><span class="lock">🔒</span>' + escapeHtml(hostFromUrl(q.url)) + "</span>" +
        "</div>" +
        '<div class="browser-body">' +
        '<div class="browser-body-title">' + escapeHtml(stripEmoji(q.title)) + "</div>" +
        '<div class="browser-body-sub">官方下載頁 · 畫面模擬</div>' +
        "</div>";
      container.appendChild(browserWin);
    } else if (q.actionType === "unlock-code") {
      var ccWin1 = document.createElement("div");
      ccWin1.className = "os-window cc-window";
      ccWin1.innerHTML =
        '<div class="os-titlebar">' +
        '<span class="os-dot red"></span><span class="os-dot yellow"></span><span class="os-dot green"></span>' +
        '<span class="os-titlebar-name">Claude Code</span>' +
        "</div>" +
        '<div class="cc-body">' +
        '<div class="cc-msg cc-msg-system">教練頻道已連線</div>' +
        '<div class="cc-inputbar cc-inputbar-target">' +
        '<span class="cc-input-text mono">' + escapeHtml(q.copyText) + "</span>" +
        '<span class="cc-send-btn">➤</span>' +
        "</div>" +
        "</div>";
      container.appendChild(ccWin1);
    } else if (q.actionType === "copy-double") {
      var ccWin2 = document.createElement("div");
      ccWin2.className = "os-window cc-window";
      ccWin2.innerHTML =
        '<div class="os-titlebar">' +
        '<span class="os-dot red"></span><span class="os-dot yellow"></span><span class="os-dot green"></span>' +
        '<span class="os-titlebar-name">Claude Code</span>' +
        "</div>" +
        '<div class="cc-body">' +
        '<div class="cc-inputbar">' +
        '<span class="cc-input-text mono">' + escapeHtml(q.copyText) + "</span>" +
        "</div>" +
        '<div class="cc-inputbar" style="margin-top:6px;">' +
        '<span class="cc-input-text mono">' + escapeHtml(q.copyText2) + "</span>" +
        "</div>" +
        "</div>";
      container.appendChild(ccWin2);
    } else {
      // copy：終端機殼
      var termWin = document.createElement("div");
      termWin.className = "os-window";
      termWin.innerHTML =
        '<div class="os-titlebar">' +
        '<span class="os-dot red"></span><span class="os-dot yellow"></span><span class="os-dot green"></span>' +
        '<span class="os-titlebar-name">terminal — zsh</span>' +
        "</div>" +
        '<div class="term-body">' +
        '<div><span class="term-prompt"></span><span class="term-cmd">' + escapeHtml(q.copyText || "") + "</span></div>" +
        '<div style="margin-top:4px;"><span class="term-prompt"></span><span class="term-cursor"></span></div>' +
        "</div>";
      container.appendChild(termWin);
    }
  }

  function hostFromUrl(url) {
    try {
      return new URL(url).host;
    } catch (e) {
      return url || "";
    }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 依 actionType 產生三件套文字內容（動作／預期）
  function questTrio(q) {
    var action, expect;
    switch (q.actionType) {
      case "download":
        action = "按「" + q.actionLabel + "」，跳頁後照指示下載安裝。";
        expect = "安裝完成、桌面或應用程式清單出現對應程式。";
        break;
      case "copy":
        action = "打開終端機、貼上（Cmd+V）、按 Enter 執行。";
        expect = "終端機跑完沒有紅字錯誤。";
        break;
      case "copy-double":
        action = "先複製第一行貼上按 Enter，再複製第二行貼上按 Enter。";
        expect = "兩行都執行完、Claude Code 沒有顯示錯誤訊息。";
        break;
      case "unlock-code":
        action = "貼上指令執行、把教練回覆的通關碼填進下面欄位。";
        expect = "通關碼驗證通過，本關關閉。";
        break;
      default:
        action = "";
        expect = "";
    }
    return { action: action, expect: expect };
  }

  var STALL_ENCOURAGE_MS = 90000;

  function goToQuest(index) {
    if (index >= questData.quests.length) {
      showCelebrationOrCertificate();
      return;
    }
    var q = questData.quests[index];
    sceneManager.goTo("scene-quest", {
      cardText: stripEmoji(q.title),
      onEnter: function () {
        renderGuideBar();
        renderQuest(q, index);
      },
    });
  }

  function renderQuest(q, index) {
    var trio = questTrio(q);
    var mentorLineEl = sceneManager.el("quest-mentor-line");
    sfx.commOpen();
    typeInto(mentorLineEl, "艦長，這一關：" + stripEmoji(q.title) + "。跟著三步走，卡住隨時可以休息。");

    sceneManager.el("quest-title").textContent = q.title;
    sceneManager.el("quest-panel-index").textContent = "SYS.0" + (index + 1) + "／0" + questData.quests.length;
    renderSimDom(q, sceneManager.el("quest-sim"));
    sceneManager.el("quest-action-desc").textContent = q.description + "（" + trio.action + "）";
    sceneManager.el("quest-expect").textContent = trio.expect;

    var actionsEl = sceneManager.el("quest-actions");
    var hintEl = sceneManager.el("quest-hint");
    actionsEl.innerHTML = "";
    hintEl.textContent = "";
    hintEl.className = "quest-hint";

    // 卡關 90 秒鼓勵（僅一次、老師主動說話）
    sceneManager.setTimer(function () {
      typeInto(mentorLineEl, "還在嗎？卡住很正常，慢慢來，我在。");
    }, STALL_ENCOURAGE_MS);

    function completeQuest() {
      if (state.done.indexOf(q.id) === -1) state.done.push(q.id);
      state.currentQuest = index + 1;
      if (state.litSystems.indexOf(q.id) === -1) state.litSystems.push(q.id);
      saveState();
      runCompletionRitual(q, index);
    }

    if (q.actionType === "download") {
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "quest-btn";
      openBtn.textContent = q.actionLabel;
      openBtn.onclick = function () {
        sfx.key();
        window.open(q.url, "_blank", "noopener");
        confirmBtn.disabled = false;
      };
      var confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "quest-btn quest-btn-complete";
      confirmBtn.textContent = q.confirmLabel;
      confirmBtn.disabled = true;
      confirmBtn.onclick = completeQuest;
      actionsEl.appendChild(openBtn);
      actionsEl.appendChild(confirmBtn);
    } else if (q.actionType === "copy") {
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "quest-btn";
      copyBtn.textContent = q.actionLabel;
      var feedback = document.createElement("span");
      feedback.className = "quest-copy-feedback";
      feedback.textContent = "已複製";
      copyBtn.onclick = function () {
        sfx.copy();
        copyToClipboard(q.copyText);
        feedback.classList.add("show");
        confirmBtn2.disabled = false;
      };
      var confirmBtn2 = document.createElement("button");
      confirmBtn2.type = "button";
      confirmBtn2.className = "quest-btn quest-btn-complete";
      confirmBtn2.textContent = q.confirmLabel;
      confirmBtn2.disabled = true;
      confirmBtn2.onclick = completeQuest;
      actionsEl.appendChild(copyBtn);
      actionsEl.appendChild(feedback);
      actionsEl.appendChild(confirmBtn2);
    } else if (q.actionType === "copy-double") {
      var copy1 = document.createElement("button");
      copy1.type = "button";
      copy1.className = "quest-btn";
      copy1.textContent = q.actionLabel;
      var copy2 = document.createElement("button");
      copy2.type = "button";
      copy2.className = "quest-btn";
      copy2.textContent = q.actionLabel2;
      copy1.onclick = function () {
        sfx.copy();
        copyToClipboard(q.copyText);
        confirmBtn3.disabled = false;
      };
      copy2.onclick = function () {
        sfx.copy();
        copyToClipboard(q.copyText2);
        confirmBtn3.disabled = false;
      };
      var confirmBtn3 = document.createElement("button");
      confirmBtn3.type = "button";
      confirmBtn3.className = "quest-btn quest-btn-complete";
      confirmBtn3.textContent = q.confirmLabel;
      confirmBtn3.disabled = true;
      confirmBtn3.onclick = completeQuest;
      actionsEl.appendChild(copy1);
      actionsEl.appendChild(copy2);
      actionsEl.appendChild(confirmBtn3);
    } else if (q.actionType === "unlock-code") {
      var copyBtn3 = document.createElement("button");
      copyBtn3.type = "button";
      copyBtn3.className = "quest-btn";
      copyBtn3.textContent = q.actionLabel;
      copyBtn3.onclick = function () {
        sfx.copy();
        copyToClipboard(q.copyText);
      };
      actionsEl.appendChild(copyBtn3);

      var codeRow = document.createElement("div");
      codeRow.className = "quest-code-row";
      var codeInput = document.createElement("input");
      codeInput.type = "text";
      codeInput.placeholder = "貼上教練給的通關碼";
      codeInput.oninput = function () { sfx.key(); };
      var verifyBtn = document.createElement("button");
      verifyBtn.type = "button";
      verifyBtn.className = "quest-btn quest-btn-complete";
      verifyBtn.textContent = "驗證通關碼";
      verifyBtn.onclick = function () {
        var val = codeInput.value.trim();
        if (val === questData.unlockCode) {
          hintEl.textContent = "通關碼正確！";
          hintEl.className = "quest-hint ok";
          completeQuest();
        } else {
          hintEl.textContent = "通關碼不對，再跟教練確認一次。";
          hintEl.className = "quest-hint error";
        }
      };
      codeRow.appendChild(codeInput);
      codeRow.appendChild(verifyBtn);
      actionsEl.appendChild(codeRow);
    }
  }

  // 完成儀式：面板跑 1.5 秒「訊號偵測」掃描動畫 → 系統亮起 → 艦員甦醒
  function runCompletionRitual(q, index) {
    sfx.complete();
    sfx.setDroneThickness(state.litSystems.length);
    var overlay = sceneManager.el("scan-overlay");
    overlay.classList.add("scan-active");
    var scanDur = REDUCE_MOTION ? 200 : 1500;
    sceneManager.setTimer(function () {
      overlay.classList.remove("scan-active");
      sfx.relay();
      showAwaken(q, index);
    }, scanDur);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      // 靜默失敗，玩家仍可手動複製 quest.description 內文字
    }
    document.body.removeChild(ta);
  }

  var CREW_TRANSITION_LINES = {
    scout: "情報員醒了，接下來換副艦。",
    writer: "副艦上線，燃料關卡繼續。",
    analyst: "燃料量表滿了，該把艦隊請進門了。",
    publisher: "入列確認收到，最後一關是教練親自驗收。",
    guard: "教練驗收通過，準備迎接全艦甦醒。",
  };

  function showAwaken(q, index) {
    var crew = findCrew(q.crewId);
    sceneManager.goTo("scene-awaken", {
      cardText: "艦員甦醒",
      onEnter: function () {
        var img = sceneManager.el("awaken-portrait");
        img.src = crew ? crew.portraitNeutral : "assets/mentor-portrait.png";
        img.alt = crew ? crew.name : "";
        sceneManager.el("awaken-name").textContent = crew ? crew.name : "";
        sceneManager.el("awaken-role").textContent = crew ? crew.role : "";
        sceneManager.el("awaken-line").textContent = q.awakenLine;

        var btn = sceneManager.el("awaken-continue-btn");
        var isLast = index + 1 >= questData.quests.length;
        btn.textContent = isLast ? "完成" : "繼續下一關";
        btn.onclick = function () {
          if (sceneManager.isTransitioning()) return;
          proceedAfterAwaken(q, index);
        };
      },
    });
  }

  function proceedAfterAwaken(q, index) {
    var nextIndex = index + 1;
    if (nextIndex >= questData.quests.length) {
      showCelebrationOrCertificate();
      return;
    }
    var transitionLine = CREW_TRANSITION_LINES[q.crewId] || "繼續下一關。";
    sceneManager.goTo("scene-quest", {
      cardText: transitionLine,
      onEnter: function () {
        renderGuideBar();
        renderQuest(questData.quests[nextIndex], nextIndex);
      },
    });
  }

  function findCrew(id) {
    if (!window.__crewData) return null;
    return window.__crewData.crew.filter(function (c) {
      return c.id === id;
    })[0];
  }

  function showCelebrationOrCertificate() {
    sceneManager.goTo("scene-celebration", {
      cardText: "全艦點燈",
      onEnter: function () {
        sfx.fleetAwaken();
        sfx.setDroneThickness(SYSTEM_COUNT);
        var wrap = sceneManager.el("celebration-crew");
        wrap.innerHTML = "";
        (window.__crewData ? window.__crewData.crew : []).forEach(function (c, i) {
          var img = document.createElement("img");
          img.src = c.portraitNeutral;
          img.alt = c.name;
          img.style.animationDelay = REDUCE_MOTION ? "0s" : i * 0.12 + "s";
          wrap.appendChild(img);
        });
        sceneManager.el("celebration-message").textContent =
          "艦長" + state.name + "，五位艦員全部就位，你的 AI 團隊已經在艦上待命。";
        sceneManager.el("celebration-continue-btn").onclick = function () {
          if (sceneManager.isTransitioning()) return;
          showCertificate();
        };
      },
    });
  }

  function showCertificate() {
    sceneManager.goTo("scene-certificate", {
      cardText: "裝備完成證書",
      onEnter: function () {
        sceneManager.el("certificate-name").textContent = state.name + " 艦長";
        renderGuideBar(); // 全通關後把嚮導列收掉（不重整的一路通關路徑）
      },
    });
  }

  // ---------------- 啟動 ----------------
  function loadCrewData(cb) {
    fetch("data/crew.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        window.__crewData = d;
      })
      .catch(function (err) {
        console.error("[fleet] 讀取艦員資料失敗", err);
        window.__crewData = { crew: [] };
      })
      .then(function () {
        // cb 的例外走 invokeLoadCallback、不被上面 fetch 的 .catch 誤吞
        invokeLoadCallback("艦員資料", function () {
          cb();
        });
      });
  }

  function boot() {
    loadState();
    initMuteButton();
    initStarfield();
    loadCrewData(function () {
      loadQuestData(function () {
        showCover();
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
