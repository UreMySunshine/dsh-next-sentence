# dsh-next-sentence

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 增加“下一句话”推荐：一轮助手工作结束后，如果输入框为空，用当前模型生成一条可以直接发送的用户消息，以暗色水印显示在输入框内；按 `Tab` 填入，按 `Esc` 关闭。插件不会自动发送消息。

支持桌面版（Web UI）和 [dsh-tui](https://github.com/ccch1mneyyy/dsh-TUI)。

## 行为

- 回合结束且输入框为空时生成一次；开始输入、切换会话、重新生成都由会话内缓存控制；
- 每个会话每轮只生成一次；切走再回来、`Tab` 填入后删掉草稿，都会恢复同一条推荐，不会重复请求模型；
- `Tab` 只把推荐填入草稿，不发送，不影响已有附件和引用；
- `Esc` 关闭本轮推荐；
- 设置中可关闭“自动推荐下一句话”，关闭后不再发起模型请求。

## 安装

从 npm 安装到桌面版配置：

```sh
dsh plugin --profile desktop add dsh-next-sentence
```

安装后重启 DeepSeek Harness。

也可以从 GitHub 安装：

```sh
dsh plugin --profile desktop add github:UreMySunshine/dsh-next-sentence
```

或者克隆仓库后使用本地目录：

```sh
git clone https://github.com/UreMySunshine/dsh-next-sentence.git
dsh plugin --profile desktop add ./dsh-next-sentence
```

## dsh-tui

终端模式在回合结束后，于输入框上方显示推荐；空草稿时按 `→` 或 `Tab` 填入，不发送。

```sh
dsh plugin --profile dsh-tui add dsh-next-sentence
```

还需要在 dsh-tui 的 `cordis.patch.yml` 中挂载 TUI 半边：

```yaml
- insert:
    - id: next-sentence-tui
      name: dsh-next-sentence/tui
```

dsh-tui 的输入组件需要支持“空草稿推荐接受入口”。安装时 `postinstall` 会尝试自动补上该入口。如果你在 dsh-tui 的 profile 里配置了：

```json
{
  "scripts": {
    "postinstall": "node node_modules/dsh-next-sentence/scripts/patch-tui.mjs"
  }
}
```

那么以后升级 dsh-tui 后，安装或更新依赖时会自动重新应用补丁。没有这项配置时，升级 dsh-tui 后需要手动执行一次：

```sh
node node_modules/dsh-next-sentence/scripts/patch-tui.mjs
```

补丁脚本是幂等的，只修改 `PromptInput.js` 中空草稿时 `→`/`Tab` 的处理，并在第一次修改前保留备份。

## 费用与上下文

推荐使用一次独立的模型请求，**不会写入当前会话日志，也不会污染上下文**。请求包含最近八条用户或助手消息的纯文本和当前模型路由；每次生成会产生一次额外调用，因此设置中提供了开关。

## 开发

```sh
npm install
npm run build
npm test
```

- `src/index.ts`：Web/桌面宿主接口，接收客户端推荐请求并调用 `ctx.llm.stream`；
- `src/client.tsx`：输入框水印、Tab 接受、设置开关；
- `src/tui.ts`：dsh-tui 状态行与接受入口；
- `src/suggestion.ts`：提示词、输出清洗；
- `scripts/build.mjs`：宿主 ESM 与客户端模块包装格式分别构建；
- `scripts/patch-tui.mjs`：dsh-tui 输入组件幂等补丁。

## 已知限制

- dsh-tui 的 `→`/`Tab` 接受依赖对输入组件的本地补丁；这是当前 dsh-tui 公开插件接口不支持的能力；
- 推荐质量取决于当前模型，可能生成不合适的句子，填入后发送前请自行确认；
- 推荐请求与正常对话一样会发送给当前模型提供方。

## License

MIT
