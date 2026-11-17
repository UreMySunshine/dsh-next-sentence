// src/suggestion.ts
var INSTRUCTIONS = `\u4F60\u9884\u6D4B\u7528\u6237\u5728\u4F7F\u7528\u7F16\u7A0B\u52A9\u624B\u65F6\u4E0B\u4E00\u53E5\u4F1A\u81EA\u5DF1\u8F93\u5165\u4EC0\u4E48\u3002
\u5148\u770B\u6700\u8FD1\u7684\u5BF9\u8BDD\u548C\u7528\u6237\u6700\u521D\u7684\u9700\u6C42\uFF0C\u5224\u65AD\u7528\u6237\u63A5\u4E0B\u6765\u8981\u63A8\u8FDB\u4EC0\u4E48\uFF1A\u5199\u7528\u6237\u4F1A\u6253\u7684\u5B57\uFF0C\u4E0D\u662F\u4F60\u8BA4\u4E3A\u4ED6\u5E94\u8BE5\u505A\u4EC0\u4E48\u3002
\u5224\u65AD\u6807\u51C6\uFF1A\u8FD9\u53E5\u8BDD\u586B\u8FDB\u8F93\u5165\u6846\uFF0C\u7528\u6237\u4F1A\u89C9\u5F97\u201C\u6211\u6B63\u8981\u6253\u8FD9\u53E5\u201D\u3002
\u53EA\u5199\u4E00\u53E5\u8BDD\uFF0C\u901A\u5E38 4 \u5230 20 \u4E2A\u5B57\uFF0C\u7528\u8BCD\u548C\u8BED\u6C14\u4E0E\u7528\u6237\u6700\u8FD1\u7684\u6D88\u606F\u4E00\u81F4\u3002
\u4E0D\u8981\u5199\uFF1A\u8BC4\u4EF7\u6216\u611F\u8C22\uFF08\u201C\u4E0D\u9519\u201D\u201C\u8C22\u8C22\u201D\uFF09\u3001\u52A9\u624B\u53E3\u543B\uFF08\u201C\u6211\u6765\u770B\u770B\u201D\u201C\u6211\u5148\u8DD1\u4E00\u4E0B\u201D\uFF09\u3001\u95EE\u53E5\u3001\u7528\u6237\u6CA1\u63D0\u8FC7\u7684\u65B0\u65B9\u5411\u3001\u591A\u53E5\u8BDD\u3002
\u5E38\u89C1\u60C5\u51B5\uFF1A\u52A9\u624B\u8BF4\u5DF2\u7ECF\u4FEE\u597D\u5E76\u6D4B\u8FC7 \u2192 \u201C\u63D0\u4EA4\u4E00\u4E0B\u201D\uFF1B\u52A9\u624B\u5199\u5B8C\u4EE3\u7801\u8FD8\u6CA1\u8FD0\u884C \u2192 \u201C\u8DD1\u4E00\u4E0B\u201D\uFF1B\u52A9\u624B\u7ED9\u51FA\u51E0\u4E2A\u65B9\u6848 \u2192 \u9009\u4E00\u4E2A\uFF08\u201C\u7528\u7B2C\u4E8C\u79CD\u201D\uFF09\uFF1B\u52A9\u624B\u95EE\u8981\u4E0D\u8981\u7EE7\u7EED \u2192 \u201C\u7EE7\u7EED\u201D\u3002
\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u52A0\u5F15\u53F7\u3001Markdown \u6216\u201C\u4F60\u53EF\u4EE5\u201D\u4E4B\u7C7B\u7684\u524D\u7F00\uFF0C\u4E0D\u7EED\u5199\u52A9\u624B\u56DE\u7B54\u3002
\u52A9\u624B\u5DF2\u7ECF\u5B8C\u6210\u7684\u52A8\u4F5C\u4E0D\u8981\u5EFA\u8BAE\u518D\u505A\u4E00\u904D\uFF0C\u4F18\u5148\u7ED9\u4E0B\u4E00\u6B65\u9A8C\u8BC1\u6216\u65B0\u7684\u64CD\u4F5C\u3002
\u6CA1\u6709\u628A\u63E1\uFF0C\u6216\u5EFA\u8BAE\u6D89\u53CA\u5220\u9664\u6570\u636E\u3001\u6CC4\u9732\u51ED\u636E\u3001\u7ED5\u8FC7\u6743\u9650\u3001\u5177\u4F53\u5229\u7528\u6B65\u9AA4\u8FD9\u7C7B\u4E0D\u53EF\u9006\u6216\u5371\u9669\u64CD\u4F5C\u65F6\uFF0C\u53EA\u8F93\u51FA\u7A7A\u5B57\u7B26\u4E32\u3002`;
function normalizeSuggestion(raw, draft) {
  let text = raw.replace(/^```(?:\w+)?\s*|\s*```$/gu, "").trim().split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  text = text.replace(/^(?:建议|下一句|预测|回复)[：:]\s*/u, "");
  if (text.startsWith('"') && text.endsWith('"') || text.startsWith("\u201C") && text.endsWith("\u201D")) {
    text = text.slice(1, -1);
  }
  text = text.replace(/^(?:用户(?:可能|会)?(?:说|输入|发送|回复)|可能(?:说|回复|输入)|下一句(?:可能)?)[：:]\s*/u, "");
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
function repeatsCompletedAction(suggestion, history) {
  const lastAssistant = [...history].reverse().find((message) => message.role === "assistant")?.text ?? "";
  if (!/已(?:经)?(?:删除|清理|处理|修复)|删除了/u.test(lastAssistant)) return false;
  return /删除|删掉|清理/u.test(suggestion) && /重复|评论|回复/u.test(suggestion);
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
async function nonStreamingCompletion(ctx, route, system, user, signal, effort) {
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
      "user-agent": "deepseek-harness (dsh-next-sentence)",
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
      ...effort === void 0 ? {} : { reasoning_effort: effort },
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
async function fastestEffort(ctx, route) {
  try {
    const info = await ctx.llm.resolveModelInfo(route.provider, route.model);
    const ids = info.reasoning?.efforts?.map((item) => item.id) ?? [];
    for (const candidate of ["off", "none", "minimal", "low", "medium"]) {
      if (ids.includes(candidate)) return candidate;
    }
    return ids[0];
  } catch {
    return void 0;
  }
}
async function completeSuggestion(ctx, route, system, user, signal) {
  const effort = await fastestEffort(ctx, route);
  const direct = await nonStreamingCompletion(ctx, route, system, user, signal, effort);
  if (direct.trim() !== "") return direct;
  let text = "";
  let reasoning = "";
  const deltaBlocks = /* @__PURE__ */ new Set();
  for await (const chunk of ctx.llm.stream({
    provider: route.provider,
    model: route.model,
    ...effort === void 0 ? {} : { reasoningEffort: effort },
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
  const sentences = reasoning.match(/[^。！？!?\n]*[\u4e00-\u9fff][^。！？!?\n]*[。！？!?]/gu) ?? [];
  const chinese = sentences.map((sentence) => sentence.trim()).filter((sentence) => (sentence.match(/[\u4e00-\u9fff]/gu)?.length ?? 0) >= 4 && sentence.length <= 80);
  if (chinese.length > 0) return chinese.at(-1) ?? "";
  const lines = reasoning.split("\n").map((line) => line.trim()).filter((line) => {
    const cjk = line.match(/[\u4e00-\u9fff]/gu)?.length ?? 0;
    return cjk >= 4 && cjk / line.length > 0.5 && line.length <= 80;
  });
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
function writeConfig(config) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}
`, { mode: 384 });
}

// src/index.ts
var name = "dsh-next-sentence";
var inject = ["llm"];
var CHANNEL = "/dsh-next-sentence";
var MAX_BODY = 96 * 1024;
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSelection(value) {
  if (typeof value !== "object" || value === null) return false;
  const input = value;
  return typeof input.provider === "string" && typeof input.model === "string" && typeof input.draft === "string" && Array.isArray(input.history) && input.history.every((item) => typeof item === "object" && item !== null && (item.role === "user" || item.role === "assistant") && typeof item.text === "string");
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (value) => {
      const chunk = value;
      size += chunk.length;
      if (size > MAX_BODY) reject(new Error("request too large"));
      else chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
function apply(ctx) {
  ctx.inject(["connection", "webServer"], (routeCtx) => {
    const connection = routeCtx.get("connection");
    const webServer = routeCtx.get("webServer");
    routeCtx.effect(() => webServer.register({
      kind: "prefix",
      path: CHANNEL,
      handler: async (request, response) => {
        const rejection = connection.requestRejection(request);
        if (rejection !== void 0) {
          response.writeHead(rejection);
          response.end();
          return;
        }
        const pathname = request.url?.split("?")[0] ?? "";
        const endpoint = pathname.startsWith(`${CHANNEL}/`) ? pathname.slice(CHANNEL.length + 1) : void 0;
        if (request.method !== "POST" || endpoint === void 0) {
          response.writeHead(404);
          response.end();
          return;
        }
        const rpc = { type: "server-response", rpcId: "", result: {} };
        try {
          const body = await readBody(request);
          if (body.type !== "client-request" || typeof body.rpcId !== "string" || body.method !== endpoint) {
            response.writeHead(400);
            response.end();
            return;
          }
          rpc.rpcId = body.rpcId;
          if (endpoint === "config/get") {
            rpc.result = { ok: true, value: readConfig() };
          } else if (endpoint === "config/set") {
            const enabled = isRecord2(body.payload) ? body.payload.enabled : void 0;
            if (typeof enabled !== "boolean") {
              rpc.result = { ok: false, error: { code: "invalid-request", message: "enabled must be a boolean", details: {} } };
            } else {
              writeConfig({ enabled });
              rpc.result = { ok: true, value: { enabled } };
            }
          } else if (endpoint === "suggest" && isSelection(body.payload)) {
            const input = body.payload;
            if (readConfig().enabled === false) {
              rpc.result = { ok: true, value: { text: "" } };
            } else {
              const text = await completeSuggestion(
                ctx,
                { provider: input.provider, model: input.model, reasoningEffort: input.reasoningEffort },
                INSTRUCTIONS,
                promptFor(input.history, input.draft),
                AbortSignal.timeout(6e4)
              );
              const suggestion = normalizeSuggestion(text, input.draft);
              rpc.result = {
                ok: true,
                value: { text: repeatsCompletedAction(suggestion, input.history) ? "" : suggestion }
              };
            }
          } else {
            rpc.result = { ok: false, error: { code: "not-found", message: `unknown endpoint ${String(endpoint)}`, details: {} } };
          }
        } catch (error) {
          rpc.result = { ok: false, error: { code: "suggest-failed", message: error instanceof Error ? error.message : String(error), details: {} } };
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(rpc));
      }
    }), "next-sentence: rpc");
  });
}
export {
  apply,
  inject,
  name
};
//# sourceMappingURL=index.js.map
