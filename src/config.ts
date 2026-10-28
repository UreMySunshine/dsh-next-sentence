import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Shared on/off switch for both the desktop client and dsh-tui. */
export const CONFIG_PATH = join(homedir(), '.dsh-next-sentence.json')

interface PluginConfig {
  enabled: boolean
}

export function readConfig(): PluginConfig {
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as { enabled?: unknown }
    return { enabled: parsed.enabled !== false }
  } catch {
    return { enabled: true }
  }
}

export function writeConfig(config: PluginConfig): void {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
}
