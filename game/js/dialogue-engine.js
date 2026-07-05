/**
 * dialogue-engine.js — 對話樹解析與執行
 * 節點格式見 data/dialogue-*.json：
 *   speaker/expression/lines/choices/setFlags/reward
 *   router 節點：{ type:"router", rules:[{if, goto}, {goto}] }
 *   end 節點：{ type:"end" }
 */

const DialogueEngine = {
  _treeCache: {},

  async loadTree(url) {
    if (this._treeCache[url]) return this._treeCache[url];
    const res = await fetch(url);
    const tree = await res.json();
    this._treeCache[url] = tree;
    return tree;
  },

  /**
   * 評估 router 節點的條件字串，只支援固定形式：
   *   "flags.<key> === true|false|數字|'字串'"
   * 不使用 Function/eval，避免任何字串拼接進可執行程式碼（安全考量）。
   */
  evalCondition(condStr, flags) {
    const m = /^flags\.([A-Za-z0-9_]+)\s*===\s*(.+)$/.exec(condStr.trim());
    if (!m) {
      console.warn("[dialogue-engine] 不支援的條件格式", condStr);
      return false;
    }
    const key = m[1];
    let rawExpected = m[2].trim();
    let expected;
    if (rawExpected === "true") expected = true;
    else if (rawExpected === "false") expected = false;
    else if (/^-?\d+(\.\d+)?$/.test(rawExpected)) expected = parseFloat(rawExpected);
    else if (/^'.*'$/.test(rawExpected) || /^".*"$/.test(rawExpected)) {
      expected = rawExpected.slice(1, -1);
    } else {
      console.warn("[dialogue-engine] 不支援的條件右值", condStr);
      return false;
    }
    return flags[key] === expected;
  },

  resolveStart(tree, flags) {
    let nodeId = tree.start;
    let node = tree.nodes[nodeId];
    let guardCount = 0;
    while (node && node.type === "router" && guardCount < 10) {
      guardCount++;
      let matched = null;
      for (const rule of node.rules) {
        if (!rule.if || this.evalCondition(rule.if, flags)) {
          matched = rule.goto;
          break;
        }
      }
      nodeId = matched || "END";
      node = tree.nodes[nodeId];
    }
    return nodeId;
  },

  getNode(tree, nodeId) {
    if (nodeId === "END" && !tree.nodes.END) {
      return { type: "end" };
    }
    return tree.nodes[nodeId];
  },

  applyNodeEffects(node) {
    if (node.setFlags) {
      for (const [k, v] of Object.entries(node.setFlags)) {
        window.SaveSystem.applyFlagOp(k, v);
      }
    }
    if (node.reward) {
      if (typeof node.reward.xp === "number" && node.reward.xp > 0) {
        window.SaveSystem.addXP(node.reward.xp, node.reward.log || "dialogue_reward");
      }
      if (node.reward.log) {
        window.SaveSystem.logEvent(node.reward.log, null);
      }
    }
  }
};

window.DialogueEngine = DialogueEngine;
