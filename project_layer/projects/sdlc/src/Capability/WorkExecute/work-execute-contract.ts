import path from "node:path";
import type {
  ContractCheckResult,
  IContractChecker,
  WorkExecuteArtifacts,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import { ShellRunner } from "../../Runtime/shell-runner.js";
import type { ContractSpec } from "../Shared/document-unit-contract.js";
import { findDocumentContract, loadContractSpecFromJson } from "../Shared/contract-spec-loader.js";

export interface ExecutionEnvironment {
  generatedResult: {
    prompt: string;
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
  prepare(context: ExecutionContext, output: ExecutionUnitResult): Promise<ExecutionEnvironment>;
}

export interface ITestRunner {
  run(environment: ExecutionEnvironment): Promise<TestRunResult>;
}

export class ShellExecutionEnvironmentPreparer implements ExecutionEnvironmentPreparer {
  async prepare(
    context: ExecutionContext,
    output: ExecutionUnitResult<WorkExecuteArtifacts>,
  ): Promise<ExecutionEnvironment> {
    const testCommand = context.params?.testCommand ?? "npm test";
    const escapedWorkspaceRoot = this.quoteForShell(context.workspaceRoot);

    return {
      generatedResult: {
        prompt: output.artifacts.prompt,
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
      scriptName: "work_execute_contract",
      summary: result.passed
        ? `Test command passed: ${environment.testCommand}`
        : `Test command failed: ${environment.testCommand}`,
      logs: result.logs,
    };
  }
}

export class ContractResultBuilder {
  build(testRunResult: TestRunResult, contractSpec: ContractSpec): ContractCheckResult {
    const failureContract = findDocumentContract(contractSpec, "work_execute_contract");
    return {
      passed: testRunResult.success,
      summary: testRunResult.summary,
      issues: testRunResult.success
        ? []
        : [
            {
              checkItem: failureContract?.check_item ?? testRunResult.scriptName,
              message: testRunResult.logs ?? testRunResult.summary,
              severity: failureContract?.severity ?? "high",
            },
          ],
    };
  }
}

// Public API: contract checker entry used to validate generated work-execute output.
export class WorkExecuteContract implements IContractChecker {
  static create(): IContractChecker {
    return new WorkExecuteContract(
      new ShellExecutionEnvironmentPreparer(),
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
    context: ExecutionContext,
    output: ExecutionUnitResult<WorkExecuteArtifacts>,
  ): Promise<ContractCheckResult> {
    const contractSpec = await loadContractSpecFromJson(
      context.workspaceRoot,
      "WorkExecuteContract.contract.json",
      "work_execute_contract",
      typeof context.params?.resourceRoot === "string" ? context.params.resourceRoot : undefined,
    );
    const environment = await this.environmentPreparer.prepare(context, output);
    const testResult = await this.testRunner.run(environment);
    return this.resultBuilder.build(testResult, contractSpec);
  }
}
