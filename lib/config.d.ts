/** Shared on/off switch for both the desktop client and dsh-tui. */
export declare const CONFIG_PATH: string;
interface PluginConfig {
    enabled: boolean;
}
export declare function readConfig(): PluginConfig;
export declare function writeConfig(config: PluginConfig): void;
export {};
