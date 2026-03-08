// Implementation contract module: prepares a test environment and converts test results into contract checks.
import { spawn } from "node:child_process";
import type {
  ContractCheckResult,
  IContractChecker,
  ImplementationStageArtifacts,
  StageOutput,
  StageRunContext,
} from "../../shared/contracts/pipeline.js";
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

export class DefaultExecutionEnvironmentPreparer implements ExecutionEnvironmentPreparer {
  async prepare(
    context: StageRunContext,
    output: StageOutput<ImplementationStageArtifacts>,
  ): Promise<ExecutionEnvironment> {
    return {
      generatedResult: {
        changedFiles: output.artifacts.changedFiles,
        summary: output.artifacts.summary,
      },
      workdir: context.workspaceRoot,
      unitTestCommand: {
        name: "implementation-contract",
        command: context.params?.testCommand ?? "npm test",
      },
    };
  }
}

export class ShellTestRunner implements ITestRunner {
  async run(environment: ExecutionEnvironment): Promise<TestRunResult> {
    const { unitTestCommand, workdir } = environment;

    return new Promise<TestRunResult>((resolve, reject) => {
      const child = spawn(unitTestCommand.command, {
        cwd: workdir,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);

      child.on("close", (code) => {
        const success = code === 0;
        const logs = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");

        resolve({
          success,
          scriptName: unitTestCommand.name,
          summary: success
            ? `Test command passed: ${unitTestCommand.command}`
            : `Test command failed: ${unitTestCommand.command}`,
          logs: logs || undefined,
        });
      });
    });
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
export class ImplementationContractService implements IContractChecker {
  static create(): IContractChecker {
    return new ImplementationContractService(
      new DefaultExecutionEnvironmentPreparer(),
      new ShellTestRunner(),
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
