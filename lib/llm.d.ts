import type { Context } from '@deepseek-ai/cordis';
export interface SuggestionRoute {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** Ask the current route for one suggestion, falling back when its stream carries no text. */
export declare function completeSuggestion(ctx: Context, route: SuggestionRoute, system: string, user: string, signal: AbortSignal): Promise<string>;
/**
 * Reasoning-only models sometimes leave the answer in the thinking stream.
 * Prefer the last quoted Chinese sentence; otherwise take the last Chinese line.
 */
export declare function fromReasoning(reasoning: string): string;
