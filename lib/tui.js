// src/suggestion.ts
var INSTRUCTIONS = `\u4F60\u8D1F\u8D23\u9884\u6D4B\u7528\u6237\u5728\u4F7F\u7528\u7F16\u7A0B\u52A9\u624B\u65F6\u4E0B\u4E00\u53E5\u6700\u53EF\u80FD\u8F93\u5165\u7684\u8BDD\u3002\u6839\u636E\u5BF9\u8BDD\u5199\u51FA\u4E00\u4E2A\u81EA\u7136\u3001\u5177\u4F53\u3001\u53EF\u4EE5\u7ACB\u5373\u53D1\u9001\u7684\u77ED\u53E5\uFF0C\u901A\u5E38\u4E0D\u8D85\u8FC750\u4E2A\u6C49\u5B57\u3002\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u6DFB\u52A0\u5F15\u53F7\u3001Markdown\u6216\u201C\u4F60\u53EF\u4EE5\u201D\u7B49\u524D\u7F00\uFF0C\u4E0D\u8981\u9884\u6D4B\u52A9\u624B\u7684\u8BDD\u3002\u7528\u6237\u5C1A\u672A\u8F93\u5165\u4E0B\u4E00\u53E5\uFF0C\u8BF7\u57FA\u4E8E\u521A\u7ED3\u675F\u7684\u5BF9\u8BDD\u9884\u6D4B\u7528\u6237\u63A5\u4E0B\u6765\u6700\u53EF\u80FD\u53D1\u9001\u7684\u5B8C\u6574\u6D88\u606F\uFF0C\u4E0D\u8981\u5EF6\u7EED\u6216\u8865\u5199\u52A9\u624B\u56DE\u7B54\u3002\u6CA1\u6709\u53EF\u9760\u9884\u6D4B\u65F6\u8F93\u51FA\u7A7A\u5B57\u7B26\u4E32\u3002`;
function normalizeSuggestion(raw, draft) {
  let text = raw.replace(/^```(?:\w+)?\s*|\s*```$/gu, "").trim().split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  text = text.replace(/^(?:建议|下一句|预测|回复)[：:]\s*/u, "");
  if (text.startsWith('"') && text.endsWith('"') || text.startsWith("\u201C") && text.endsWith("\u201D")) {
    text = text.slice(1, -1);
  }
  if (/^[（(]?(?:空字符串|空|无|none|null)[）)]?$/iu.test(text)) return "";
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

// src/llm.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function providerConfig(ctx, provider) {
  const settings = ctx.get("settings", false);
  if (settings === void 0) return void 0;
  let section;
  try {
    section = settings.get?.("llm-pi-ai") ?? settings.describe?.().find((row) => row.ns === "llm-pi-ai")?.value;
  } catch {
    return void 0;
  }
  if (!isRecord(section) || !isRecord(section.providers)) return void 0;
  const config = section.providers[provider];
  return isRecord(config) ? config : void 0;
}
async function nonStreamingCompletion(ctx, route, system, user, signal) {
  const config = providerConfig(ctx, route.provider);
  if (config?.baseURL === void 0) {
    console.error("[dsh-next-sentence] no baseURL for", route.provider);
    return "";
  }
  const base = config.baseURL.replace(/\/+$/u, "");
  const apiKey = config.apiKeyEnv === void 0 ? void 0 : process.env[config.apiKeyEnv];
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...apiKey === void 0 || apiKey === "" ? {} : { authorization: `Bearer ${apiKey}` }
    },
    body: JSON.stringify({
      model: route.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 4096,
      temperature: 0.4,
      stream: false
    }),
    signal
  });
  if (!response.ok) {
    console.error("[dsh-next-sentence] fallback HTTP", response.status, await response.text().catch(() => ""));
    return "";
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}
async function completeSuggestion(ctx, route, system, user, signal) {
  const direct = await nonStreamingCompletion(ctx, route, system, user, signal);
  if (direct.trim() !== "") return direct;
  let text = "";
  let reasoning = "";
  const deltaBlocks = /* @__PURE__ */ new Set();
  for await (const chunk of ctx.llm.stream({
    provider: route.provider,
    model: route.model,
    ...route.reasoningEffort === void 0 ? {} : { reasoningEffort: route.reasoningEffort },
    system,
    messages: [{ role: "user", content: [{ type: "text", text: user }] }],
    maxTokens: 4096,
    temperature: 0.4,
    signal
  })) {
    if (chunk.type === "text-delta") {
      deltaBlocks.add(chunk.index);
      text += chunk.text;
    }
    if (chunk.type === "block-end" && chunk.block.type === "text" && !deltaBlocks.has(chunk.index)) {
      text += chunk.block.text;
    }
    if (chunk.type === "reasoning-delta") reasoning += chunk.text;
    if (chunk.type === "block-end" && chunk.block.type === "reasoning") reasoning += chunk.block.text;
  }
  if (text.trim() !== "") return text;
  return fromReasoning(reasoning) || nonStreamingCompletion(ctx, route, system, user, signal);
}
function fromReasoning(reasoning) {
  const quoted = [...reasoning.matchAll(/[“"]([^”"\n]{4,120})[”"]/gu)].map((match) => match[1]?.trim() ?? "").filter((text) => /[\u4e00-\u9fff]/u.test(text));
  if (quoted.length > 0) return quoted.at(-1) ?? "";
  const lines = reasoning.split("\n").map((line) => line.trim()).filter((line) => /[\u4e00-\u9fff]/u.test(line) && line.length <= 120);
  return lines.at(-1) ?? "";
}

// src/config.ts
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var CONFIG_PATH = join(homedir(), ".dsh-next-sentence.json");
function readConfig() {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return { enabled: parsed.enabled !== false };
  } catch {
    return { enabled: true };
  }
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
  const publish = (text) => {
    state.suggestion = text;
    state.set?.(text);
  };
  state.accept = () => {
    return state.suggestion;
  };
  const runtime = globalThis;
  runtime.__dshNextSentenceAccept = state.accept;
  runtime.__dshNextSentenceSubscribe = (set) => {
    state.set = set;
    set(state.suggestion);
    return () => {
      if (state.set === set) state.set = void 0;
    };
  };
  ctx.effect(() => () => {
    runtime.__dshNextSentenceSubscribe = void 0;
    runtime.__dshNextSentenceAccept = void 0;
  }, "next-sentence: tui globals");
  ctx.on("session/event", (session, event) => {
    if (event.type === "turn/start" || event.type === "user/message") {
      pending.get(session)?.abort();
      pending.delete(session);
      publish("");
      return;
    }
    if (event.type !== "turn/end" || ctx.llm === void 0) return;
    if (readConfig().enabled === false) {
      publish("");
      return;
    }
    const controller = new AbortController();
    pending.set(session, controller);
    const header = session.requestHeader();
    if (!header) {
      status?.set("next-sentence:error", "\u63A8\u8350\u751F\u6210\u5931\u8D25\uFF1A\u5F53\u524D\u4F1A\u8BDD\u6CA1\u6709\u6A21\u578B\u8DEF\u7531");
      return;
    }
    const { provider, model } = header.config;
    void (async () => {
      const text = await completeSuggestion(ctx, { provider, model }, INSTRUCTIONS, promptFor(historyOf(session), ""), controller.signal);
      if (!controller.signal.aborted) publish(normalizeSuggestion(text, ""));
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
