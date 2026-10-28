window.__ModuleLoader__.load({
	id: "dsh-next-sentence",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "sessions", "modelDirectories", "connection"];
var SLOT = "conversation.input.overlay";
var SETTINGS_SLOT = "settings.general.item";
var ENABLED_STORAGE_KEY = "dsh-next-sentence.enabled";
function readEnabledPreference() {
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}
var enabledPreference = readEnabledPreference();
var enabledListeners = /* @__PURE__ */ new Set();
var enabledStore = {
  getSnapshot: () => enabledPreference,
  subscribe: (listener) => {
    enabledListeners.add(listener);
    return () => enabledListeners.delete(listener);
  },
  set: (enabled) => {
    if (enabledPreference === enabled) return;
    enabledPreference = enabled;
    try {
      window.localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
    } catch {
    }
    enabledListeners.forEach((listener) => listener());
  }
};
function EnabledSetting({ rpc }) {
  const enabled = (0, import_react.useSyncExternalStore)(enabledStore.subscribe, enabledStore.getSnapshot);
  (0, import_react.useEffect)(() => {
    if (rpc === void 0) return;
    let cancelled = false;
    void rpc.call("/dsh-next-sentence", "config/get", {}).then((result) => {
      const response = result;
      if (!cancelled && response.ok && typeof response.value?.enabled === "boolean") {
        enabledStore.set(response.value.enabled);
      }
    }).catch(() => void 0);
    return () => {
      cancelled = true;
    };
  }, [rpc]);
  const toggle = () => {
    const next = !enabled;
    enabledStore.set(next);
    void rpc?.call("/dsh-next-sentence", "config/set", { enabled: next }).catch(() => void 0);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ns-setting-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ns-setting-copy", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ns-setting-title", children: "\u81EA\u52A8\u63A8\u8350\u4E0B\u4E00\u53E5\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "ns-setting-description", children: "\u56DE\u5408\u7ED3\u675F\u540E\uFF0C\u7528\u5F53\u524D\u6A21\u578B\u751F\u6210\u4E00\u53E5\u53EF Tab \u586B\u5165\u7684\u5EFA\u8BAE\uFF1B\u6BCF\u6B21\u63A8\u8350\u662F\u4E00\u6B21\u5355\u72EC\u7684\u6A21\u578B\u8BF7\u6C42\u3002\u6B64\u5F00\u5173\u540C\u65F6\u63A7\u5236\u684C\u9762\u7AEF\u4E0E dsh-tui\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "ns-setting-control", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ns-setting-state", children: enabled ? "\u5F00\u542F" : "\u5173\u95ED" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          role: "switch",
          "aria-label": "\u81EA\u52A8\u63A8\u8350\u4E0B\u4E00\u53E5\u8BDD",
          "aria-checked": enabled,
          className: `ns-setting-switch${enabled ? " is-on" : ""}`,
          onClick: toggle,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ns-setting-switch-knob", "aria-hidden": "true" })
        }
      )
    ] })
  ] });
}
function historyOf(source) {
  const messages = [];
  for (const entry of source.getSnapshot().entries) {
    const event = entry.event;
    if (event.type !== "user/message" && event.type !== "assistant/message") continue;
    const message = event.type === "user/message" ? event.data : event.data.message;
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
    if (text) messages.push({ role: event.type === "user/message" ? "user" : "assistant", text });
  }
  return messages.slice(-8);
}
function editorEnd(actions) {
  const selection = window.getSelection();
  if (!selection?.isCollapsed) return false;
  const root = selection?.anchorNode instanceof Element ? selection.anchorNode.closest('[contenteditable="true"]') : selection?.anchorNode?.parentElement?.closest('[contenteditable="true"]');
  if (!root) return false;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setStart(selection.anchorNode, selection.anchorOffset);
  return range.toString().length === 0;
}
function Watermark({ text }) {
  const ref = (0, import_react.useRef)(null);
  (0, import_react.useLayoutEffect)(() => {
    const node = ref.current;
    if (!node) return;
    const card = node.closest("[data-composer-card]");
    if (!card) return;
    const placeholderFor = () => card.querySelector("[data-composer-placeholder]");
    const editorFor = () => card.querySelector('[contenteditable="true"]');
    const update = (show = true) => {
      const editor2 = editorFor();
      if (!editor2) return;
      const placeholder = placeholderFor();
      const line = editor2.querySelector("p") ?? editor2;
      const rect = (placeholder ?? line).getBoundingClientRect();
      const style = getComputedStyle(placeholder ?? editor2);
      Object.assign(node.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${editor2.getBoundingClientRect().width}px`,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        opacity: show ? "1" : "0"
      });
      if (placeholder && placeholder.style.visibility !== "hidden") {
        placeholder.style.visibility = "hidden";
      }
    };
    update(false);
    let active = true;
    const frame = requestAnimationFrame(() => {
      if (!active) return;
      update();
      requestAnimationFrame(() => {
        if (active) update();
      });
    });
    const timers = [80, 240, 600].map((delay) => window.setTimeout(() => {
      if (active) update(true);
    }, delay));
    const resize = new ResizeObserver(() => update(true));
    const editor = editorFor();
    if (editor) {
      resize.observe(editor);
      const line = editor.querySelector("p");
      if (line) resize.observe(line);
    }
    const mutations = new MutationObserver(() => update(true));
    mutations.observe(card, { childList: true, subtree: true });
    const onResize = () => update(true);
    window.addEventListener("resize", onResize);
    void document.fonts?.ready.then(() => {
      if (active) update(true);
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", onResize);
      card.querySelectorAll("[data-composer-placeholder]").forEach((el) => {
        el.style.visibility = "";
      });
    };
  }, [text]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { ref, className: "dsh-next-sentence", "aria-hidden": "true", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-next-sentence-text", children: text }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", { children: "Tab / \u2192" })
  ] });
}
var sessionCaches = /* @__PURE__ */ new Map();
function Suggestion({ running, input, inputActions, eventSource, directory, rpc, sessionId }) {
  const enabled = (0, import_react.useSyncExternalStore)(enabledStore.subscribe, enabledStore.getSnapshot);
  const cacheRef = (0, import_react.useRef)();
  if (!cacheRef.current || cacheRef.current !== sessionCaches.get(sessionId)) {
    cacheRef.current = sessionCaches.get(sessionId) ?? { suggestion: "", settled: false, dismissed: false };
    sessionCaches.set(sessionId, cacheRef.current);
  }
  const cache = cacheRef.current;
  const [suggestion, setSuggestion] = (0, import_react.useState)(cache.suggestion);
  const suggestionRef = (0, import_react.useRef)(cache.suggestion);
  (0, import_react.useEffect)(() => {
    setSuggestion(cache.suggestion);
  }, [cache]);
  const revision = (0, import_react.useSyncExternalStore)(
    (listener) => eventSource.subscribe(listener),
    () => eventSource.getSnapshot().revision
  );
  const selected = (0, import_react.useSyncExternalStore)(
    (listener) => directory.store.subscribe(listener),
    () => directory.store.getSnapshot().current
  );
  suggestionRef.current = suggestion;
  (0, import_react.useEffect)(() => {
    if (running) {
      cache.settled = true;
      cache.dismissed = false;
      cache.suggestion = "";
      setSuggestion("");
    }
  }, [running, cache]);
  (0, import_react.useEffect)(() => {
    if (revision > 0 && cache.dismissed) cache.dismissed = false;
  }, [revision, cache]);
  (0, import_react.useEffect)(() => {
    if (!enabled) {
      setSuggestion("");
      return;
    }
    if (input.draft || running) {
      if (input.draft) setSuggestion("");
      return;
    }
    const history = historyOf(eventSource);
    if (history.length === 0) {
      cache.suggestion = "";
      setSuggestion("");
      return;
    }
    if (cache.suggestion) {
      setSuggestion(cache.suggestion);
      return;
    }
    if (revision === 0) return;
    if (cache.dismissed || !rpc || running || input.draft !== "") return;
    if (!selected) {
      void directory.load().catch(() => void 0);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const model = directory.store.getSnapshot().current;
      if (!model || controller.signal.aborted) return;
      try {
        const response = await rpc.call("/dsh-next-sentence", "suggest", {
          ...model,
          history,
          draft: ""
        });
        if (!controller.signal.aborted && response.ok) {
          cache.suggestion = response.value?.text ?? "";
          setSuggestion(cache.suggestion);
        }
      } catch {
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, running, revision, input.draft, input.phase, selected, rpc, eventSource, directory, cache]);
  (0, import_react.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && suggestionRef.current) {
        event.preventDefault();
        event.stopPropagation();
        cache.suggestion = "";
        cache.dismissed = true;
        setSuggestion("");
        return;
      }
      const isRight = event.key === "ArrowRight" || event.key === "Right" || event.code === "ArrowRight" || event.keyCode === 39;
      if (event.key !== "Tab" && !isRight || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (!suggestionRef.current || !editorEnd(inputActions)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const span = inputActions.captureInsertion();
      if (inputActions.insertText(suggestionRef.current, span)) {
        setSuggestion("");
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [inputActions, cache]);
  if (!suggestion) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Watermark, { text: suggestion });
}
function apply(ctx) {
  const sessions = ctx.sessions;
  const directories = ctx.modelDirectories;
  const rpc = ctx.get("connection")?.rpc;
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-next-sentence";
    style.textContent = `
      .dsh-next-sentence { position:fixed; z-index:4; display:flex; align-items:center; opacity:0;
        gap:8px; min-width:0; pointer-events:none; color:var(--dsw-alias-label-tertiary); }
      .dsh-next-sentence-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .dsh-next-sentence kbd { flex:none; padding:0 4px; border:1px solid var(--dsw-alias-border-l1);
        border-radius:4px; font:10px/16px inherit; color:var(--dsw-alias-label-caption); }
      .ns-setting-row { display:flex; align-items:center; justify-content:space-between; gap:24px;
        padding:16px 0; border-bottom:1px solid var(--dsw-alias-border-l2, rgba(121,126,145,.18)); }
      .ns-setting-copy { min-width:0; }
      .ns-setting-title { color:var(--dsw-alias-label-primary,#15171b); font-size:14px; line-height:22px; }
      .ns-setting-description { margin-top:3px; color:var(--dsw-alias-label-tertiary,#9296a0); font-size:12px; line-height:18px; }
      .ns-setting-control { display:inline-flex; align-items:center; gap:10px; flex:none; }
      .ns-setting-state { color:var(--dsw-alias-label-secondary,#686c75); font-size:13px; }
      .ns-setting-switch { position:relative; width:38px; height:22px; padding:0; border:0; border-radius:999px;
        background:var(--dsw-alias-fill-quaternary,#c7cbd3); cursor:pointer; transition:background 150ms ease; }
      .ns-setting-switch.is-on { background:var(--dsw-alias-state-business-primary,#4f73ff); }
      .ns-setting-switch-knob { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%;
        background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2); transition:transform 170ms cubic-bezier(.22,1,.36,1); }
      .ns-setting-switch.is-on .ns-setting-switch-knob { transform:translateX(16px); }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, "next-sentence: styles");
  ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register(
    { name: SETTINGS_SLOT, id: "next-sentence-enabled", order: 30 },
    () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnabledSetting, { rpc })
  ));
  ctx.slots.inject(SLOT, () => ctx.slots.register({ name: SLOT, id: "next-sentence" }, (props) => {
    const ref = (0, import_react.useRef)(null);
    if (ref.current?.sessionId !== props.sessionId) {
      ref.current?.release();
      ref.current = sessions.retain(props.sessionId, { source: "next-sentence" });
    }
    (0, import_react.useEffect)(() => () => {
      ref.current?.release();
      ref.current = null;
    }, []);
    const eventSource = ref.current.binding.eventSource;
    const session = ref.current.binding.session;
    const running = (0, import_react.useSyncExternalStore)(
      (listener) => session.subscribe(listener),
      () => session.getSnapshot().running
    );
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      Suggestion,
      {
        running,
        input: props.useInput((input) => input),
        inputActions: props.inputActions,
        eventSource,
        directory: directories.directoryFor(props.sessionId),
        sessionId: props.sessionId,
        rpc
      }
    );
  }));
}

		return module.exports;
	}
})
//# sourceMappingURL=client.js.map
