/**
 * save.js — 存檔系統
 * localStorage key: fleetGame.v1
 * 內容：profile（艦長基本狀態）、flags（對話記憶旗標）、streak（連續登艦）、xp（航程）、log（事件紀錄）
 */

const SAVE_KEY = "fleetGame.v1";

function todayLocalDateString() {
  // 本地日界線（不用 UTC），避免時區跨日誤判
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + "T00:00:00");
  const b = new Date(dateStrB + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function defaultSave() {
  return {
    version: 1,
    createdAt: todayLocalDateString(),
    profile: {
      hasSeenIntro: false,
      rank: "見習"
    },
    flags: {},
    streak: {
      count: 0,
      lastCheckinDate: null
    },
    xp: {
      total: 0
    },
    dailyTasks: {
      // date -> { taskId: true }
    },
    unlockedArchivePages: [],
    completedQuests: {},
    eventLog: []
  };
}

const SaveSystem = {
  _cache: null,

  load() {
    if (this._cache) return this._cache;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        this._cache = defaultSave();
        return this._cache;
      }
      const parsed = JSON.parse(raw);
      // merge with defaults to survive schema growth
      const base = defaultSave();
      this._cache = {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...(parsed.profile || {}) },
        flags: { ...(parsed.flags || {}) },
        streak: { ...base.streak, ...(parsed.streak || {}) },
        xp: { ...base.xp, ...(parsed.xp || {}) },
        dailyTasks: { ...(parsed.dailyTasks || {}) },
        completedQuests: { ...(parsed.completedQuests || {}) },
        eventLog: parsed.eventLog || []
      };
      if (!this._cache.unlockedArchivePages) this._cache.unlockedArchivePages = [];
      return this._cache;
    } catch (e) {
      console.warn("[save.js] 讀檔失敗，使用預設存檔", e);
      this._cache = defaultSave();
      return this._cache;
    }
  },

  persist() {
    if (!this._cache) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this._cache));
    } catch (e) {
      console.error("[save.js] 寫檔失敗", e);
    }
  },

  reset() {
    localStorage.removeItem(SAVE_KEY);
    this._cache = defaultSave();
    this.persist();
    return this._cache;
  },

  // ---- flags (對話記憶旗標) ----
  getFlag(key) {
    return this.load().flags[key];
  },
  setFlag(key, value) {
    const s = this.load();
    s.flags[key] = value;
    this.persist();
  },
  incrementFlag(key, delta = 1) {
    const s = this.load();
    const cur = typeof s.flags[key] === "number" ? s.flags[key] : 0;
    s.flags[key] = cur + delta;
    this.persist();
    return s.flags[key];
  },

  /**
   * 對話樹的 setFlags 值可能是 true/false 字面值，
   * 也可能是 "+1" 這種相對增量字串（給 guard_respect 用）
   */
  applyFlagOp(key, opValue) {
    if (typeof opValue === "string" && /^[+-]\d+$/.test(opValue)) {
      this.incrementFlag(key, parseInt(opValue, 10));
    } else {
      this.setFlag(key, opValue);
    }
  },

  // ---- streak ----
  checkinToday() {
    const s = this.load();
    const today = todayLocalDateString();
    if (s.streak.lastCheckinDate === today) {
      return { alreadyCheckedIn: true, streak: s.streak.count };
    }
    if (s.streak.lastCheckinDate) {
      const gap = daysBetween(s.streak.lastCheckinDate, today);
      if (gap === 1) {
        s.streak.count += 1;
      } else if (gap > 1) {
        s.streak.count = 1; // 斷了重算
      }
      // gap <= 0 不應發生（已在上面攔過同天）
    } else {
      s.streak.count = 1;
    }
    s.streak.lastCheckinDate = today;
    this.persist();
    this.updateRank();
    return { alreadyCheckedIn: false, streak: s.streak.count };
  },

  updateRank() {
    const s = this.load();
    const thresholds = [
      { rank: "艦長", minStreak: 30 },
      { rank: "少校", minStreak: 14 },
      { rank: "中尉", minStreak: 7 },
      { rank: "少尉", minStreak: 3 },
      { rank: "見習", minStreak: 0 }
    ];
    for (const t of thresholds) {
      if (s.streak.count >= t.minStreak) {
        s.profile.rank = t.rank;
        break;
      }
    }
    this.persist();
  },

  // ---- xp ----
  addXP(amount, reason) {
    const s = this.load();
    s.xp.total += amount;
    s.eventLog.push({
      type: "xp",
      amount,
      reason: reason || null,
      at: new Date().toISOString()
    });
    this.persist();
    return s.xp.total;
  },

  // ---- daily tasks ----
  isDailyTaskDone(taskId) {
    const s = this.load();
    const today = todayLocalDateString();
    return !!(s.dailyTasks[today] && s.dailyTasks[today][taskId]);
  },
  markDailyTaskDone(taskId) {
    const s = this.load();
    const today = todayLocalDateString();
    if (!s.dailyTasks[today]) s.dailyTasks[today] = {};
    if (s.dailyTasks[today][taskId]) {
      return false; // 已完成過，不重複發 XP
    }
    s.dailyTasks[today][taskId] = true;
    this.persist();
    return true;
  },

  logEvent(name, data) {
    const s = this.load();
    s.eventLog.push({ type: "event", name, data: data || null, at: new Date().toISOString() });
    this.persist();
  },

  markIntroSeen() {
    const s = this.load();
    s.profile.hasSeenIntro = true;
    this.persist();
  },

  unlockArchivePages(pageNumbers) {
    const s = this.load();
    if (!s.unlockedArchivePages) s.unlockedArchivePages = [];
    const before = s.unlockedArchivePages.length;
    pageNumbers.forEach((page) => {
      if (!s.unlockedArchivePages.includes(page)) s.unlockedArchivePages.push(page);
    });
    s.unlockedArchivePages.sort((a, b) => a - b);
    if (s.unlockedArchivePages.length !== before) this.persist();
    return s.unlockedArchivePages;
  },

  getUnlockedArchivePages() {
    const s = this.load();
    return s.unlockedArchivePages || [];
  },

  isQuestComplete(questId) {
    return !!this.load().completedQuests[questId];
  },

  markQuestComplete(questId) {
    const s = this.load();
    if (s.completedQuests[questId]) return false;
    s.completedQuests[questId] = true;
    this.persist();
    return true;
  }
};

window.SaveSystem = SaveSystem;
