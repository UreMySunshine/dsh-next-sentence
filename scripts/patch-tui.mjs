import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
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
const source = readFileSync(file, 'utf8')
if (source.includes('__dshNextSentenceAccept')) process.exit(0)

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
copyFileSync(file, `${file}.dsh-next-sentence.backup.js`)
writeFileSync(file, `${source.slice(0, index)}${patch}${source.slice(index)}`)
console.log('dsh-next-sentence: applied dsh-tui empty-draft suggestion support')
