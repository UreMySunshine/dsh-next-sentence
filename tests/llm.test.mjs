import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { completeSuggestion } from '../lib/llm.js'

for (const apiKey of [undefined, 'test-key']) {
  test(`推荐请求携带 DSH 客户端标识${apiKey === undefined ? '，不添加认证' : '，保留认证'}`, async t => {
    let received
    const server = createServer((request, response) => {
      const chunks = []
      request.on('data', chunk => chunks.push(chunk))
      request.on('end', () => {
        received = { url: request.url, headers: request.headers, body: JSON.parse(Buffer.concat(chunks).toString()) }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ choices: [{ message: { content: '运行测试。' } }] }))
      })
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    t.after(() => new Promise(resolve => server.close(resolve)))

    const envName = 'DSH_NEXT_SENTENCE_TEST_KEY'
    const previous = process.env[envName]
    if (apiKey === undefined) delete process.env[envName]
    else process.env[envName] = apiKey
    t.after(() => {
      if (previous === undefined) delete process.env[envName]
      else process.env[envName] = previous
    })
    const ctx = {
      get: () => ({ get: () => ({ providers: { test: { baseURL: `http://127.0.0.1:${server.address().port}/v1`, apiKeyEnv: envName } } }) }),
      llm: {
        resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'low' }] } }),
        stream: () => { throw new Error('非空回答不应触发流式回退') },
      },
    }

    const text = await completeSuggestion(ctx, { provider: 'test', model: 'test-model' }, 'system', 'user', AbortSignal.timeout(5000))
    assert.equal(text, '运行测试。')
    assert.equal(received.url, '/v1/chat/completions')
    assert.equal(received.headers['user-agent'], 'deepseek-harness (dsh-next-sentence)')
    assert.equal(received.headers['content-type'], 'application/json')
    assert.equal(received.headers.authorization, apiKey === undefined ? undefined : `Bearer ${apiKey}`)
    assert.deepEqual(received.body, {
      model: 'test-model',
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'user' }],
      max_tokens: 4096,
      temperature: 0.4,
      reasoning_effort: 'low',
      stream: false,
    })
  })
}
