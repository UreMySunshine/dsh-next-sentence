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
export {
  completeSuggestion,
  fromReasoning
};
//# sourceMappingURL=llm.js.map
