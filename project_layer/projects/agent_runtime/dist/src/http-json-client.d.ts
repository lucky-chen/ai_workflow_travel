export interface FetchResponseLike {
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<unknown>;
}
export type FetchLike = (input: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal?: AbortSignal;
}) => Promise<FetchResponseLike>;
export declare class HttpJsonClient {
    private readonly fetchFn?;
    constructor(fetchFn?: FetchLike | undefined);
    postJson<TRequest, TResponse>(url: string, options: {
        headers: Record<string, string>;
        body: TRequest;
        timeoutMs?: number;
    }): Promise<TResponse>;
    private getFetch;
}
