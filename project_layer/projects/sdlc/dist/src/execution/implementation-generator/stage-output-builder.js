export class StageOutputBuilder {
    build(stageId, result) {
        return {
            stageId,
            success: true,
            summary: result.summary,
            artifacts: {
                changedFiles: result.changedFiles,
                summary: result.summary,
            },
        };
    }
}
