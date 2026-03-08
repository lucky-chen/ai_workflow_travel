import type { FetchLike } from "./http-json-client.js";
export type RealLlmProvider = "openai" | "deepseek";
export interface RealProviderConfig {
    provider?: RealLlmProvider;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
    fetchFn?: FetchLike;
}
