/* 課前裝備發放 v3 — 單檔邏輯
 * 單一狀態源：localStorage['fleetOnboard.v2'] = {name, currentQuest, done[], seenOpening}
 * 帶鎖轉場：transition token，轉場中鎖輸入、連點不壞
 * 計時器歸場景：每場景 teardown 清自己的 timers
 */
(function () {
  "use strict";

  var STORAGE_KEY = "fleetOnboard.v2";
  var QUESTS_URL = "data/install-quests.json";

  // ---------------- 狀態 ----------------
  var state = {
    name: "",
    currentQuest: 0, // 尚未完成的下一關 index
    done: [],
    seenOpening: false,
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

    // 顯示轉場字卡 → 切場景 → 隱藏字卡。帶 token，避免連點造成疊加轉場。
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
    }

    function isTransitioning() {
      return transitioning;
    }

    function setTimer(fn, ms) {
      var id = setTimeout(fn, ms);
      return registerTimer(id);
    }

    return {
      goTo: goTo,
      isTransitioning: isTransitioning,
      setTimer: setTimer,
      el: el,
      currentScene: function () {
        return currentScene;
      },
    };
  })();

  // ---------------- 音效（三個合成音、預設開、可靜音） ----------------
  var sfx = (function () {
    var muted = false;
    try {
      muted = localStorage.getItem("fleetOnboard.muted") === "1";
    } catch (e) {}
    var ctx = null;

    function getCtx() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      return ctx;
    }

    function tone(freqs, dur, type) {
      if (muted) return;
      var ac = getCtx();
      if (!ac) return;
      if (ac.state === "suspended") ac.resume();
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

    return {
      stamp: function () { tone([220, 110], 0.18, "square"); }, // 蓋章：低沉短音
      complete: function () { tone([660, 880], 0.22, "sine"); }, // 完成叮：清亮兩音
      fleetAwaken: function () { tone([392, 494, 587, 659], 0.9, "sine"); }, // 全艦甦醒：和弦
      toggleMute: function () {
        muted = !muted;
        try {
          localStorage.setItem("fleetOnboard.muted", muted ? "1" : "0");
        } catch (e) {}
        return muted;
      },
      isMuted: function () {
        return muted;
      },
    };
  })();

  // ---------------- 老師三句開場 ----------------
  var MENTOR_INTRO_LINES = [
    "歡迎上艦、艦長。",
    "接下來一關一關來、玩完你電腦上就有一支真的 AI 團隊——開課那天帶著它來。",
    "先說老實話：等一下會用到電腦裡的『終端機』。不用怕、每一步都有圖、我全程都在。大約 30-45 分鐘、隨時可以休息、進度我記著。",
  ];

  // ---------------- 資料載入 ----------------
  function loadQuestData(cb) {
    if (questData) return cb(questData);
    fetch(QUESTS_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("quest data fetch failed: " + r.status);
        return r.json();
      })
      .then(function (data) {
        questData = data;
        cb(data);
      })
      .catch(function (err) {
        console.error("[fleet] 讀取關卡資料失敗", err);
        // 降級：給空清單，至少不讓畫面整個死掉
        questData = { unlockCode: "", quests: [] };
        cb(questData);
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
        lineEl.textContent = MENTOR_INTRO_LINES[lineIndex];
        btn.textContent = lineIndex < MENTOR_INTRO_LINES.length - 1 ? "繼續" : "開始裝備發放";
        btn.onclick = function () {
          if (sceneManager.isTransitioning()) return;
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
        lineEl.textContent =
          "艦長" + state.name + "，上次到第 " + (state.currentQuest + 1) + " 關・" + stripEmoji(q.title) + "，繼續？";
        btn.textContent = "繼續";
        btn.onclick = function () {
          if (sceneManager.isTransitioning()) return;
          goToQuest(state.currentQuest);
        };
      },
    });
  }

  // 依 actionType 產生三件套內容
  function questTrio(q) {
    var sim, action, expect;
    switch (q.actionType) {
      case "download":
        sim = "畫面會跳出官方下載頁。";
        action = "按「" + q.actionLabel + "」，跳頁後照指示下載安裝。";
        expect = "安裝完成、桌面或應用程式清單出現對應程式。";
        break;
      case "copy":
        sim = "指令已複製到剪貼簿。";
        action = "打開終端機、貼上（Cmd+V）、按 Enter 執行。";
        expect = "終端機跑完沒有紅字錯誤。";
        break;
      case "copy-double":
        sim = "兩行指令分別複製、貼進 Claude Code 輸入列。";
        action = "先複製第一行貼上按 Enter，再複製第二行貼上按 Enter。";
        expect = "兩行都執行完、Claude Code 沒有顯示錯誤訊息。";
        break;
      case "unlock-code":
        sim = "指令已複製，貼進 Claude Code 後教練會給你一組通關碼。";
        action = "貼上指令執行、把教練回覆的通關碼填進下面欄位。";
        expect = "通關碼驗證通過，本關關閉。";
        break;
      default:
        sim = "";
        action = "";
        expect = "";
    }
    return { sim: sim, action: action, expect: expect };
  }

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
    sceneManager.el("quest-mentor-line").textContent =
      "艦長，這一關：" + stripEmoji(q.title) + "。跟著三步走，卡住隨時可以休息。";
    sceneManager.el("quest-title").textContent = q.title;
    sceneManager.el("quest-sim").textContent = trio.sim;
    sceneManager.el("quest-action-desc").textContent = q.description + "（" + trio.action + "）";
    sceneManager.el("quest-expect").textContent = trio.expect;

    var actionsEl = sceneManager.el("quest-actions");
    var hintEl = sceneManager.el("quest-hint");
    actionsEl.innerHTML = "";
    hintEl.textContent = "";
    hintEl.className = "quest-hint";

    function completeQuest() {
      if (state.done.indexOf(q.id) === -1) state.done.push(q.id);
      state.currentQuest = index + 1;
      saveState();
      sfx.complete();
      showAwaken(q, index);
    }

    if (q.actionType === "download") {
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "quest-btn";
      openBtn.textContent = q.actionLabel;
      openBtn.onclick = function () {
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
        copyToClipboard(q.copyText);
        confirmBtn3.disabled = false;
      };
      copy2.onclick = function () {
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
        copyToClipboard(q.copyText);
      };
      actionsEl.appendChild(copyBtn3);

      var codeRow = document.createElement("div");
      codeRow.className = "quest-code-row";
      var codeInput = document.createElement("input");
      codeInput.type = "text";
      codeInput.placeholder = "貼上教練給的通關碼";
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

        // 自動進下一關（保留手動按鈕以防玩家想細看小卡，兩者皆可）
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
      cardText: "全艦甦醒",
      onEnter: function () {
        sfx.fleetAwaken();
        var wrap = sceneManager.el("celebration-crew");
        wrap.innerHTML = "";
        (window.__crewData ? window.__crewData.crew : []).forEach(function (c) {
          var img = document.createElement("img");
          img.src = c.portraitNeutral;
          img.alt = c.name;
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
        cb();
      })
      .catch(function (err) {
        console.error("[fleet] 讀取艦員資料失敗", err);
        window.__crewData = { crew: [] };
        cb();
      });
  }

  function boot() {
    loadState();
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
