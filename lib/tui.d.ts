import type { Context } from '@deepseek-ai/cordis';
import type { Session } from '@deepseek-ai/dsh-session';
import { type HistoryMessage } from './suggestion.js';
export declare const name = "dsh-next-sentence-tui";
export declare const inject: string[];
export declare function historyOf(session: Session): HistoryMessage[];
export declare function apply(ctx: Context): void;
