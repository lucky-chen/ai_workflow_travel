// Implementation contract module: prepares a test environment and converts test results into contract checks.
import type {
  ContractCheckResult,
  IContractChecker,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";

export interface ExecutionEnvironment {
  workdir: string;
  unitTestCommand: string;
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

export class ContractResultBuilder {
  build(testRunResult: TestRunResult): ContractCheckResult {
    return {
      passed: testRunResult.success,
      summary: testRunResult.summary,
      issues: testRunResult.success
        ? []
        : [
            {
              checkItem: testRunResult.scriptName,
              message: testRunResult.logs ?? testRunResult.summary,
              severity: "high",
            },
          ],
    };
  }
}

// Public API: contract checker entry used by stage runners to validate generated implementation output.
export class ImplementationContractService implements IContractChecker {
  constructor(
    private readonly environmentPreparer: ExecutionEnvironmentPreparer,
    private readonly testRunner: ITestRunner,
    private readonly resultBuilder: ContractResultBuilder,
  ) {}

  async check(context: StageRunContext, output: StageOutput): Promise<ContractCheckResult> {
    const environment = await this.environmentPreparer.prepare(context, output);
    const testResult = await this.testRunner.run(environment);
    return this.resultBuilder.build(testResult);
  }
}
