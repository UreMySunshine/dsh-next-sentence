import type { Context } from '@deepseek-ai/cordis';
export interface SuggestionRoute {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** Ask the current route for one suggestion, falling back when its stream carries no text. */
export declare function completeSuggestion(ctx: Context, route: SuggestionRoute, system: string, user: string, signal: AbortSignal): Promise<string>;
