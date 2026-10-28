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
              rpc.result = { ok: true, value: { text: normalizeSuggestion(text, input.draft) } };
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
