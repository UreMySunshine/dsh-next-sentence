export const INSTRUCTIONS = `你预测用户在使用编程助手时下一句会自己输入什么。
先看最近的对话和用户最初的需求，判断用户接下来要推进什么：写用户会打的字，不是你认为他应该做什么。
判断标准：这句话填进输入框，用户会觉得“我正要打这句”。
只写一句话，通常 4 到 20 个字，用词和语气与用户最近的消息一致。
不要写：评价或感谢（“不错”“谢谢”）、助手口吻（“我来看看”“我先跑一下”）、问句、用户没提过的新方向、多句话。
常见情况：助手说已经修好并测过 → “提交一下”；助手写完代码还没运行 → “跑一下”；助手给出几个方案 → 选一个（“用第二种”）；助手问要不要继续 → “继续”。
不要解释，不加引号、Markdown 或“你可以”之类的前缀，不续写助手回答。
助手已经完成的动作不要建议再做一遍，优先给下一步验证或新的操作。
没有把握，或建议涉及删除数据、泄露凭据、绕过权限、具体利用步骤这类不可逆或危险操作时，只输出空字符串。`

export interface HistoryMessage {
  role: 'user' | 'assistant'
  text: string
}

/** The first user turn plus the latest seven messages, so the original request survives long sessions. */
export function windowHistory(messages: readonly HistoryMessage[]): HistoryMessage[] {
  const recent = messages.slice(-7)
  const original = messages.find(message => message.role === 'user')
  return original === undefined || recent.includes(original) ? recent : [original, ...recent]
}

export function normalizeSuggestion(raw: string, draft: string): string {
  let text = raw.replace(/^```(?:\w+)?\s*|\s*```$/gu, '').trim()
    .split('\n').find(line => line.trim().length > 0)?.trim() ?? ''
  text = text.replace(/^(?:建议|下一句|预测|回复)[：:]\s*/u, '')
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
    text = text.slice(1, -1)
  }
  text = text.replace(/^(?:用户(?:可能|会)?(?:说|输入|发送|回复)|可能(?:说|回复|输入)|下一句(?:可能)?)[：:]\s*/u, '')
  if (/^[（(]?(?:空字符串|空|无|none|null)[）)]?$/iu.test(text)) return ''
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


/** Suppress a suggestion that repeats an action the last assistant reply already completed. */
export function repeatsCompletedAction(suggestion: string, history: readonly HistoryMessage[]): boolean {
  const lastAssistant = [...history].reverse().find(message => message.role === 'assistant')?.text ?? ''
  if (!/已(?:经)?(?:删除|清理|处理|修复)|删除了/u.test(lastAssistant)) return false
  return /删除|删掉|清理/u.test(suggestion) && /重复|评论|回复/u.test(suggestion)
}
