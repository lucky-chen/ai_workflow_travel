import type { ContractCheckResult, IContractChecker, ImplementationStageArtifacts, StageOutput, StageRunContext } from "../../shared/contracts/pipeline.js";
import type { ChangedFile } from "../../shared/types/common.js";
export interface ExecutionEnvironment {
    generatedResult: {
        changedFiles: ChangedFile[];
        summary: string;
    };
    workdir: string;
    unitTestCommand: {
        name: string;
        command: string;
    };
}
export interface TestRunResult {
    success: boolean;
    scriptName: string;
    summary: string;
    logs?: string;
}
export interface ExecutionEnvironmentPreparer {
    prepare(context: StageRunContext, output: StageOutput): Promise<ExecutionEnvironment>;
}
export interface ITestRunner {
    run(environment: ExecutionEnvironment): Promise<TestRunResult>;
}
export declare class DefaultExecutionEnvironmentPreparer implements ExecutionEnvironmentPreparer {
    prepare(context: StageRunContext, output: StageOutput<ImplementationStageArtifacts>): Promise<ExecutionEnvironment>;
}
export declare class ShellTestRunner implements ITestRunner {
    run(environment: ExecutionEnvironment): Promise<TestRunResult>;
}
export declare class ContractResultBuilder {
    build(testRunResult: TestRunResult): ContractCheckResult;
}
export declare class ImplementationContractService implements IContractChecker {
    private readonly environmentPreparer;
    private readonly testRunner;
    private readonly resultBuilder;
    static create(): IContractChecker;
    constructor(environmentPreparer: ExecutionEnvironmentPreparer, testRunner: ITestRunner, resultBuilder: ContractResultBuilder);
    check(context: StageRunContext, output: StageOutput<ImplementationStageArtifacts>): Promise<ContractCheckResult>;
}
