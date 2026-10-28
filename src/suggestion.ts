export const INSTRUCTIONS = `你负责预测用户在使用编程助手时下一句最可能输入的话。根据对话写出一个自然、具体、可以立即发送的短句，通常不超过50个汉字。不要解释，不要添加引号、Markdown或“你可以”等前缀，不要预测助手的话。用户尚未输入下一句，请基于刚结束的对话预测用户接下来最可能发送的完整消息，不要延续或补写助手回答。没有可靠预测时输出空字符串。`

export interface HistoryMessage {
  role: 'user' | 'assistant'
  text: string
}

export function normalizeSuggestion(raw: string, draft: string): string {
  let text = raw.replace(/^```(?:\w+)?\s*|\s*```$/gu, '').trim()
    .split('\n').find(line => line.trim().length > 0)?.trim() ?? ''
  text = text.replace(/^(?:建议|下一句|预测|回复)[：:]\s*/u, '')
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
    text = text.slice(1, -1)
  }
  if (draft && text.startsWith(draft)) text = text.slice(draft.length)
  if (draft && text && !/[\s，。！？；：、,.!?;:）)\]]$/u.test(draft) && !/^[\s，。！？；：、,.!?;:（(\[]/u.test(text)) {
    text = ` ${text}`
  }
  return text.slice(0, 240)
}

export function promptFor(history: readonly HistoryMessage[], draft: string): string {
  const transcript = history.slice(-8).map(message =>
    `${message.role === 'user' ? '用户' : '助手'}：${message.text.slice(-4000)}`,
  ).join('\n')
  return `${transcript || '暂无对话。'}\n用户当前草稿：${draft || '（空）'}\n请输出用户下一句输入。`
}
