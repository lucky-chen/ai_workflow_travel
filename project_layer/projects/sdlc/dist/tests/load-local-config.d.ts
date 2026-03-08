export interface LocalConfig {
    llm?: {
        provider?: "openai" | "deepseek";
        api_key?: string;
        base_url?: string;
        model?: string;
    };
}
export declare function loadLocalConfig(): Promise<LocalConfig>;
