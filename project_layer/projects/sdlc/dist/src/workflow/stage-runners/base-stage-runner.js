export class BaseStageRunner {
    traceRecorder;
    changeGate;
    artifactStore;
    constructor(dependencies = {}) {
        this.traceRecorder = dependencies.traceRecorder;
        this.changeGate = dependencies.changeGate;
        this.artifactStore = dependencies.artifactStore;
    }
    async recordStageStart(context) {
        await this.traceRecorder?.recordTrace({
            taskId: context.taskId,
            stageId: context.stageId,
            eventType: "stage_started",
            summary: `Stage "${context.stageId}" started.`,
        });
    }
    async runContractCheck(contractChecker, context, output) {
        return contractChecker.check(context, output);
    }
    async reviewChanges(changeRequest) {
        const decision = this.changeGate
            ? await this.changeGate.review(changeRequest)
            : {
                action: "apply",
                summary: "No change gate configured. Changes applied by default.",
            };
        await this.traceRecorder?.recordTrace({
            taskId: changeRequest.taskId,
            stageId: changeRequest.stageId,
            eventType: "gate_reviewed",
            summary: decision.summary,
            metadata: {
                action: decision.action,
            },
        });
        return decision;
    }
}
