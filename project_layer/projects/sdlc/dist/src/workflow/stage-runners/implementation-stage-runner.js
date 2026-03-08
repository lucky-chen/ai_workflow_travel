import { ChangeApplier } from "../../execution/implementation-generator/change-applier.js";
import { BaseStageRunner } from "./base-stage-runner.js";
export class ImplementationStageRunner extends BaseStageRunner {
    dependencies;
    changeApplier = new ChangeApplier();
    constructor(dependencies) {
        super(dependencies);
        this.dependencies = dependencies;
    }
    async run(context) {
        await this.recordStageStart(context);
        const output = await this.dependencies.generator.run(context);
        const contractResult = await this.runContractCheck(this.dependencies.contractChecker, context, output);
        if (!contractResult.passed) {
            throw new Error(`Implementation contract failed: ${contractResult.summary}`);
        }
        const gateDecision = await this.reviewChanges({
            taskId: context.taskId,
            stageId: context.stageId,
            summary: output.summary,
            changedPaths: output.artifacts.changedFiles.map((file) => file.path),
            changedFiles: output.artifacts.changedFiles,
        });
        if (gateDecision.action !== "apply") {
            throw new Error(`Change review ended with action "${gateDecision.action}".`);
        }
        await this.changeApplier.applyChangedFiles(output.artifacts.changedFiles, context.workspaceRoot);
        return output;
    }
}
