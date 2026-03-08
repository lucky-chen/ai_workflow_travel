export class MockLlmExecutor {
    mockContent;
    constructor(mockContent) {
        this.mockContent = mockContent;
    }
    async execute(request) {
        return {
            content: this.mockContent ??
                JSON.stringify({
                    summary: "Mock implementation change set",
                    changed_files: [],
                    request_preview: request.prompt.userPrompt.slice(0, 200),
                }),
            responseFormat: request.responseFormat,
            metadata: request.metadata,
        };
    }
}
