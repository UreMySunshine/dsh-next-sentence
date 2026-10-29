// src/suggestion.ts
var INSTRUCTIONS = `\u4F60\u8D1F\u8D23\u9884\u6D4B\u7528\u6237\u5728\u4F7F\u7528\u7F16\u7A0B\u52A9\u624B\u65F6\u4E0B\u4E00\u53E5\u6700\u53EF\u80FD\u8F93\u5165\u7684\u8BDD\u3002\u6839\u636E\u5BF9\u8BDD\u5199\u51FA\u4E00\u4E2A\u81EA\u7136\u3001\u5177\u4F53\u3001\u53EF\u4EE5\u7ACB\u5373\u53D1\u9001\u7684\u77ED\u53E5\uFF0C\u901A\u5E38\u4E0D\u8D85\u8FC750\u4E2A\u6C49\u5B57\u3002\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981\u6DFB\u52A0\u5F15\u53F7\u3001Markdown\u6216\u201C\u4F60\u53EF\u4EE5\u201D\u7B49\u524D\u7F00\uFF0C\u4E0D\u8981\u9884\u6D4B\u52A9\u624B\u7684\u8BDD\u3002\u7528\u6237\u5C1A\u672A\u8F93\u5165\u4E0B\u4E00\u53E5\uFF0C\u8BF7\u57FA\u4E8E\u521A\u7ED3\u675F\u7684\u5BF9\u8BDD\u9884\u6D4B\u7528\u6237\u63A5\u4E0B\u6765\u6700\u53EF\u80FD\u53D1\u9001\u7684\u5B8C\u6574\u6D88\u606F\uFF0C\u4E0D\u8981\u5EF6\u7EED\u6216\u8865\u5199\u52A9\u624B\u56DE\u7B54\u3002\u6700\u8FD1\u4E00\u6761\u52A9\u624B\u6D88\u606F\u5DF2\u7ECF\u8BF4\u660E\u5B8C\u6210\u3001\u5DF2\u5220\u9664\u6216\u5DF2\u5904\u7406\u7684\u4E8B\u60C5\uFF0C\u4E0D\u8981\u518D\u6B21\u5EFA\u8BAE\u91CD\u590D\u6267\u884C\uFF1B\u4F18\u5148\u7ED9\u51FA\u4E0B\u4E00\u6B65\u9A8C\u8BC1\u6216\u65B0\u7684\u64CD\u4F5C\u3002\u6CA1\u6709\u53EF\u9760\u9884\u6D4B\u65F6\u8F93\u51FA\u7A7A\u5B57\u7B26\u4E32\u3002`;
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
export {
  INSTRUCTIONS,
  normalizeSuggestion,
  promptFor,
  repeatsCompletedAction
};
//# sourceMappingURL=suggestion.js.map
