// CLI module: parses user commands, maps them to workflow requests, and renders basic output.
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
export class DefaultCLICommandParser {
    parse(argv) {
        const [command, ...rest] = argv;
        if (!command) {
            throw new Error("Missing CLI command.");
        }
        const options = {};
        for (let index = 0; index < rest.length; index += 1) {
            const token = rest[index];
            if (!token.startsWith("--")) {
                throw new Error(`Unexpected CLI token: ${token}`);
            }
            const key = token.slice(2);
            const value = rest[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error(`Missing value for CLI option: --${key}`);
            }
            options[key] = value;
            index += 1;
        }
        return {
            command,
            options,
        };
    }
}
export class DefaultCLIRequestMapper {
    map(command) {
        if (command.command !== "generate") {
            throw new Error(`Unsupported CLI command: ${command.command}`);
        }
        const stageId = command.options.module;
        const input = command.options.input;
        const workspace = command.options.workspace;
        if (!stageId) {
            throw new Error("Missing required option: --module");
        }
        if (!input) {
            throw new Error("Missing required option: --input");
        }
        if (!workspace) {
            throw new Error("Missing required option: --workspace");
        }
        return {
            startStageId: stageId,
            workspaceRoot: workspace,
            inputArtifacts: {
                moduleDesign: input,
            },
        };
    }
}
export class ConsoleTraceViewer {
    renderStatus(message) {
        process.stdout.write(`${message}\n`);
    }
    renderTrace(event) {
        const scope = event.stageId ? `[${event.stageId}] ` : "";
        process.stdout.write(`${scope}${event.eventType}: ${event.summary}\n`);
    }
    renderResult(summary) {
        process.stdout.write(`${summary}\n`);
    }
}
export class ConsoleReviewInteraction {
    promptAdapter;
    constructor(promptAdapter = new ReadlinePromptAdapter()) {
        this.promptAdapter = promptAdapter;
    }
    async waitForReview(reviewSession) {
        this.promptAdapter.write(`Review: ${reviewSession.summary}\n`);
        for (const changedFile of reviewSession.changedFiles) {
            this.promptAdapter.write(`- ${changedFile.operation} ${changedFile.path}${changedFile.content ? "\n" + changedFile.content : ""}\n`);
        }
        const answer = (await this.promptAdapter.ask("Apply changes? [apply/reject/comment]: ")).trim().toLowerCase();
        if (answer === "reject") {
            return {
                action: "reject",
                summary: "User rejected the change set.",
            };
        }
        if (answer === "comment") {
            const comment = (await this.promptAdapter.ask("Enter review comment: ")).trim();
            return {
                action: "wait",
                summary: "User requested changes before apply.",
                comment,
            };
        }
        return {
            action: "apply",
            summary: "User approved the change set.",
        };
    }
}
class ReadlinePromptAdapter {
    async ask(prompt) {
        const rl = createInterface({ input, output });
        try {
            return await rl.question(prompt);
        }
        finally {
            rl.close();
        }
    }
    write(message) {
        output.write(message);
    }
}
// Public API: CLI entry implementation that dispatches user commands into workflow requests.
export class CLIService {
    commandParser;
    requestMapper;
    pipelineClient;
    traceViewer;
    constructor(commandParser, requestMapper, pipelineClient, traceViewer) {
        this.commandParser = commandParser;
        this.requestMapper = requestMapper;
        this.pipelineClient = pipelineClient;
        this.traceViewer = traceViewer;
    }
    async run(argv) {
        const parsed = this.commandParser.parse(argv);
        const request = this.requestMapper.map(parsed);
        this.traceViewer.renderTrace({
            taskId: "pending",
            eventType: "task_launch_requested",
            summary: `Launching command "${parsed.command}" for stage "${request.startStageId}".`,
        });
        const taskId = await this.pipelineClient.launchTask(request);
        this.traceViewer.renderStatus(`Task launched: ${taskId}`);
        this.traceViewer.renderResult(`Completed command: ${parsed.command}`);
        return 0;
    }
}
