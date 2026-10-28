import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveTuiManifest() {
  const roots = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
  for (const root of roots) {
    try {
      return createRequire(join(root, 'package.json')).resolve('@deepseek-harness-tui/dsh-tui/package.json')
    } catch {}
  }
  return null
}

const manifest = resolveTuiManifest()
if (!manifest) process.exit(0)

const file = join(dirname(manifest), 'lib/types/components/PromptInput.js')
if (!existsSync(file)) process.exit(0)
const backup = `${file}.dsh-next-sentence.backup.js`
const current = readFileSync(file, 'utf8')

const APPLIED = 'dsh-next-sentence: applied'
const KEY_MARK = '__dshNextSentenceAccept'
const SUB_MARK = '__dshNextSentenceSubscribe'

/** All three edits present and only once each. */
function isComplete(text) {
  return text.includes(KEY_MARK) && text.includes(SUB_MARK) && text.includes('nextSentence ? _jsx(Text')
}

/** Prefer the pristine file saved before the first edit. */
const base = existsSync(backup) ? readFileSync(backup, 'utf8') : current
if (isComplete(current) && isComplete(base)) process.exit(0)
if (isComplete(current)) {
  // Current file is fully patched; refresh a stale backup from the package's own
  // pristine copy is not possible here, so keep everything as is.
  process.exit(0)
}

let source = base
if (!existsSync(backup) || base.includes(KEY_MARK)) {
  // No usable pristine backup: derive the pristine file by removing our blocks.
  source = current
    .replace(/\n        \/\/ A next-sentence plugin may fill an empty draft without submitting it\.\n        if \(\(key\.tab \|\| key\.rightArrow\) && value\.length === 0\) \{\n            const accepted = globalThis\.__dshNextSentenceAccept\?\.\(\);\n            if \(accepted\) \{\n                setInput\(accepted, accepted\.length, 'step'\);\n                return;\n            \}\n        \}/, '')
    .replace(/\n    const \[nextSentence, setNextSentence\] = React\.useState\(''\);\n    React\.useEffect\(\(\) => \{\n        const subscribe = globalThis\.__dshNextSentenceSubscribe;\n        if \(typeof subscribe !== 'function'\) return;\n        return subscribe\(setNextSentence\);\n    \}, \[\]\);/, '')
    .replace(/nextSentence \? _jsx\(Text, \{ dimColor: true, wrap: "truncate-end", children: nextSentence \}\) : null, /, '')
  copyFileSync(file, backup)
}

if (!source.includes(KEY_MARK)) {
  const anchor = `        // Tab while the model is working = queue for AFTER the turn (followup),`
  const index = source.indexOf(anchor)
  if (index < 0 || source.indexOf(anchor, index + anchor.length) >= 0) {
    throw new Error('dsh-next-sentence: unsupported dsh-tui PromptInput; no changes made')
  }
  const patch = `        // A next-sentence plugin may fill an empty draft without submitting it.
        if ((key.tab || key.rightArrow) && value.length === 0) {
            const accepted = globalThis.__dshNextSentenceAccept?.();
            if (accepted) {
                setInput(accepted, accepted.length, 'step');
                return;
            }
        }
`
  source = `${source.slice(0, index)}${patch}${source.slice(index)}`
}

if (!source.includes(SUB_MARK)) {
  const anchor = `    const [cursor, setCursor] = React.useState(0);`
  if (source.indexOf(anchor) < 0 || source.indexOf(anchor, source.indexOf(anchor) + 1) >= 0) {
    throw new Error('dsh-next-sentence: unsupported dsh-tui PromptInput state; no changes made')
  }
  const patch = `    const [nextSentence, setNextSentence] = React.useState('');
    React.useEffect(() => {
        const read = () => {
            const next = globalThis.__dshNextSentenceTui?.suggestion ?? '';
            setNextSentence(current => (current === next ? current : next));
        };
        read();
        const timer = setInterval(read, 400);
        return () => clearInterval(timer);
    }, []);`
  source = source.replace(anchor, `${anchor}\n${patch}`)
}

if (!source.includes('nextSentence ? _jsx(Text')) {
  const anchor = `children: value.length === 0 ? (_jsxs(_Fragment, { children: [nativeCursor ? _jsx(Text, { children: ' ' }) : caretCell('empty', ' '), `
  if (source.indexOf(anchor) < 0) {
    throw new Error('dsh-next-sentence: unsupported dsh-tui PromptInput render; no changes made')
  }
  source = source.replace(anchor, `${anchor}nextSentence ? _jsx(Text, { dimColor: true, wrap: "truncate-end", children: nextSentence }) : null, `)
}

writeFileSync(file, source)
console.log('dsh-next-sentence: applied dsh-tui inline suggestion support')
