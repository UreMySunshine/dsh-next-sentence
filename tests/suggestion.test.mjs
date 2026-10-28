import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSuggestion, promptFor } from '../lib/suggestion.js'

test('只保留一行并移除包裹引号', () => {
  assert.equal(normalizeSuggestion('“运行测试并检查结果。”\n说明', ''), '运行测试并检查结果。')
})

test('模型重复草稿时移除重复部分', () => {
  assert.equal(normalizeSuggestion('请运行测试', '请'), ' 运行测试')
})

test('已有标点或空白时不增加空格', () => {
  assert.equal(normalizeSuggestion('运行测试', '请 '), '运行测试')
  assert.equal(normalizeSuggestion('，并检查报错', '请运行测试'), '，并检查报错')
})

test('上下文限制为最近八条', () => {
  const history = Array.from({ length: 10 }, (_, index) => ({ role: 'user', text: `第${index}条` }))
  const prompt = promptFor(history, '继续')
  assert(!prompt.includes('第0条'))
  assert(prompt.includes('第9条'))
  assert(prompt.endsWith('请输出用户下一句输入。'))
})
