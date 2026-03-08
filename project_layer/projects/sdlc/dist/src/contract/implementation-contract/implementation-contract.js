// Implementation contract module: prepares a test environment and converts test results into contract checks.
import { spawn } from "node:child_process";
export class DefaultExecutionEnvironmentPreparer {
    async prepare(context, output) {
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
export class ShellTestRunner {
    async run(environment) {
        const { unitTestCommand, workdir } = environment;
        return new Promise((resolve, reject) => {
            const child = spawn(unitTestCommand.command, {
                cwd: workdir,
                shell: true,
                stdio: ["ignore", "pipe", "pipe"],
            });
            let stdout = "";
            let stderr = "";
            child.stdout.on("data", (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr.on("data", (chunk) => {
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
    build(testRunResult) {
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
export class ImplementationContractService {
    environmentPreparer;
    testRunner;
    resultBuilder;
    static create() {
        return new ImplementationContractService(new DefaultExecutionEnvironmentPreparer(), new ShellTestRunner(), new ContractResultBuilder());
    }
    constructor(environmentPreparer, testRunner, resultBuilder) {
        this.environmentPreparer = environmentPreparer;
        this.testRunner = testRunner;
        this.resultBuilder = resultBuilder;
    }
    async check(context, output) {
        const environment = await this.environmentPreparer.prepare(context, output);
        const testResult = await this.testRunner.run(environment);
        return this.resultBuilder.build(testResult);
    }
}
