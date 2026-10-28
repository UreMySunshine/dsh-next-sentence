// src/suggestion.ts
var INSTRUCTIONS = `\u4F60\u8D1F\u8D23\u9884\u6D4B\u7528\u6237\u5728\u4F7F\u7528\u7F16\u7A0B\u52A9\u624B\u65F6\u4E0B\u4E00\u53E5\u6700\u53EF\u80FD\u8F93\u5165\u7684\u8BDD\u3002\u6839\u636E\u5BF9\u8BDD\u5199\u51FA\u4E00\u4E2A\u81EA\u7136\u3001\u5177\u4F53\u3001\u53EF\u4EE5\u7ACB\u5373\u53D1\u9001\u7684\u77ED\u53E5\uFF0C\u901A\u5E38\u4E0D\u8D85\u8FC750\u4E2A\u6C49\u5B57\u3002\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u6DFB\u52A0\u5F15\u53F7\u3001Markdown\u6216\u201C\u4F60\u53EF\u4EE5\u201D\u7B49\u524D\u7F00\uFF0C\u4E0D\u8981\u9884\u6D4B\u52A9\u624B\u7684\u8BDD\u3002\u7528\u6237\u5C1A\u672A\u8F93\u5165\u4E0B\u4E00\u53E5\uFF0C\u8BF7\u57FA\u4E8E\u521A\u7ED3\u675F\u7684\u5BF9\u8BDD\u9884\u6D4B\u7528\u6237\u63A5\u4E0B\u6765\u6700\u53EF\u80FD\u53D1\u9001\u7684\u5B8C\u6574\u6D88\u606F\uFF0C\u4E0D\u8981\u5EF6\u7EED\u6216\u8865\u5199\u52A9\u624B\u56DE\u7B54\u3002\u6CA1\u6709\u53EF\u9760\u9884\u6D4B\u65F6\u8F93\u51FA\u7A7A\u5B57\u7B26\u4E32\u3002`;
function normalizeSuggestion(raw, draft) {
  let text = raw.replace(/^```(?:\w+)?\s*|\s*```$/gu, "").trim().split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  text = text.replace(/^(?:建议|下一句|预测|回复)[：:]\s*/u, "");
  if (text.startsWith('"') && text.endsWith('"') || text.startsWith("\u201C") && text.endsWith("\u201D")) {
    text = text.slice(1, -1);
  }
  if (draft && text.startsWith(draft)) text = text.slice(draft.length);
  if (draft && text && !/[\s，。！？；：、,.!?;:）)\]]$/u.test(draft) && !/^[\s，。！？；：、,.!?;:（(\[]/u.test(text)) {
    text = ` ${text}`;
  }
  return text.slice(0, 240);
}
function promptFor(history, draft) {
  const transcript = history.slice(-8).map(
    (message) => `${message.role === "user" ? "\u7528\u6237" : "\u52A9\u624B"}\uFF1A${message.text.slice(-4e3)}`
  ).join("\n");
  return `${transcript || "\u6682\u65E0\u5BF9\u8BDD\u3002"}
\u7528\u6237\u5F53\u524D\u8349\u7A3F\uFF1A${draft || "\uFF08\u7A7A\uFF09"}
\u8BF7\u8F93\u51FA\u7528\u6237\u4E0B\u4E00\u53E5\u8F93\u5165\u3002`;
}

// src/tui.ts
var name = "dsh-next-sentence-tui";
var inject = ["llm"];
function host() {
  const global = globalThis;
  return global.__dshNextSentenceTui ??= { suggestion: "" };
}
function historyOf(session) {
  const messages = [];
  for (const event of session.snapshotEvents()) {
    if (event.type !== "user/message" && event.type !== "assistant/message") continue;
    const message = event.type === "user/message" ? event.data : event.data.message;
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
    if (text) messages.push({ role: event.type === "user/message" ? "user" : "assistant", text });
  }
  return messages.slice(-8);
}
function apply(ctx) {
  let status;
  ctx.inject(["tuiStatus"], (statusCtx) => {
    status = statusCtx.get("tuiStatus");
  });
  const pending = /* @__PURE__ */ new Map();
  const state = host();
  state.accept = () => {
    const text = state.suggestion;
    state.suggestion = "";
    status?.set("next-sentence", void 0);
    return text;
  };
  globalThis.__dshNextSentenceAccept = state.accept;
  ctx.on("session/event", (session, event) => {
    if (event.type === "turn/start" || event.type === "user/message") {
      pending.get(session)?.abort();
      pending.delete(session);
      state.suggestion = "";
      status?.set("next-sentence", void 0);
      return;
    }
    if (event.type !== "turn/end" || ctx.llm === void 0) return;
    const controller = new AbortController();
    pending.set(session, controller);
    const header = session.requestHeader();
    if (!header) {
      status?.set("next-sentence:error", "\u63A8\u8350\u751F\u6210\u5931\u8D25\uFF1A\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u6A21\u578B\u8DEF\u7531");
      return;
    }
    const { provider, model } = header.config;
    void (async () => {
      let text = "";
      for await (const chunk of ctx.llm.stream({
        provider,
        model,
        system: INSTRUCTIONS,
        messages: [{ role: "user", content: [{ type: "text", text: promptFor(historyOf(session), "") }] }],
        maxTokens: 160,
        temperature: 0.4,
        signal: controller.signal
      })) {
        if (chunk.type === "text-delta") text += chunk.text;
      }
      if (!controller.signal.aborted) {
        state.suggestion = normalizeSuggestion(text, "");
        status?.set("next-sentence", state.suggestion ? `\u2192 / Tab \u586B\u5165 \xB7 ${state.suggestion}` : void 0);
      }
    })().catch((error) => {
      status?.set("next-sentence:error", `\u63A8\u8350\u751F\u6210\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      if (pending.get(session) === controller) pending.delete(session);
    });
  });
  ctx.on("session/disposed", (session) => pending.get(session)?.abort());
  ctx.effect(() => () => {
    for (const controller of pending.values()) controller.abort();
    state.suggestion = "";
    delete globalThis.__dshNextSentenceAccept;
  }, "next-sentence: tui");
}
export {
  apply,
  historyOf,
  inject,
  name
};
//# sourceMappingURL=tui.js.map
