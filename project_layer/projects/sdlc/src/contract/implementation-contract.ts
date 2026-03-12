// Implementation contract module: prepares a test environment and converts test results into contract checks.
import path from "node:path";
import type {
  ContractCheckResult,
  IContractChecker,
  ImplementationStageArtifacts,
  StageOutput,
  StageRunContext,
} from "../shared/contracts/pipeline.js";
import type { ChangedFile } from "../shared/types/common.js";
import { ShellRunner } from "../workflow/shell-runner.js";

export interface ExecutionEnvironment {
  generatedResult: {
    changedFiles: ChangedFile[];
    summary: string;
  };
  testCommand: string;
  command: string;
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

export class DefaultExecutionEnvironmentPreparer implements ExecutionEnvironmentPreparer {
  async prepare(
    context: StageRunContext,
    output: StageOutput<ImplementationStageArtifacts>,
  ): Promise<ExecutionEnvironment> {
    const testCommand = context.params?.testCommand ?? "npm test";
    const escapedWorkspaceRoot = this.quoteForShell(context.workspaceRoot);

    return {
      generatedResult: {
        changedFiles: output.artifacts.changedFiles,
        summary: output.artifacts.summary,
      },
      testCommand,
      command: `cd ${escapedWorkspaceRoot} && ${testCommand}`,
    };
  }

  private quoteForShell(workspaceRoot: string): string {
    const normalized = path.resolve(workspaceRoot);
    return `'${normalized.replaceAll("'", `'\\''`)}'`;
  }
}

export class ShellCommandTestRunner implements ITestRunner {
  constructor(private readonly shellRunner: ShellRunner) {}

  async run(environment: ExecutionEnvironment): Promise<TestRunResult> {
    const result = await this.shellRunner.run(environment.command);
    return {
      success: result.passed,
      scriptName: "implementation-contract",
      summary: result.passed
        ? `Test command passed: ${environment.testCommand}`
        : `Test command failed: ${environment.testCommand}`,
      logs: result.logs,
    };
  }
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
export class ImplementationContract implements IContractChecker {
  static create(): IContractChecker {
    return new ImplementationContract(
      new DefaultExecutionEnvironmentPreparer(),
      new ShellCommandTestRunner(new ShellRunner()),
      new ContractResultBuilder(),
    );
  }

  constructor(
    private readonly environmentPreparer: ExecutionEnvironmentPreparer,
    private readonly testRunner: ITestRunner,
    private readonly resultBuilder: ContractResultBuilder,
  ) {}

  async check(
    context: StageRunContext,
    output: StageOutput<ImplementationStageArtifacts>,
  ): Promise<ContractCheckResult> {
    const environment = await this.environmentPreparer.prepare(context, output);
    const testResult = await this.testRunner.run(environment);
    return this.resultBuilder.build(testResult);
  }
}
