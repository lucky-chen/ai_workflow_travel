import assert from "node:assert/strict";
import { CLIService, ConsoleReviewInteraction, DefaultCLICommandParser, DefaultCLIRequestMapper, } from "../src/interface/cli/cli.js";
export async function runCliTests() {
    await testCommandParser();
    await testRequestMapper();
    await testCliRunSuccess();
    await testCliRunMissingWorkspace();
    await testReviewInteractionApply();
    await testReviewInteractionReject();
    await testReviewInteractionComment();
}
async function testCommandParser() {
    const parser = new DefaultCLICommandParser();
    assert.deepEqual(parser.parse(["generate", "--module", "implementation", "--input", "module.md", "--workspace", "./demo"]), {
        command: "generate",
        options: {
            module: "implementation",
            input: "module.md",
            workspace: "./demo",
        },
    });
}
async function testRequestMapper() {
    const mapper = new DefaultCLIRequestMapper();
    assert.deepEqual(mapper.map({
        command: "generate",
        options: {
            module: "implementation",
            input: "module.md",
            workspace: "./demo",
        },
    }), {
        startStageId: "implementation",
        workspaceRoot: "./demo",
        inputArtifacts: {
            moduleDesign: "module.md",
        },
    });
}
async function testCliRunSuccess() {
    const parser = new DefaultCLICommandParser();
    const mapper = new DefaultCLIRequestMapper();
    const rendered = [];
    const traceViewer = {
        renderStatus(message) {
            rendered.push(`status:${message}`);
        },
        renderTrace(event) {
            rendered.push(`trace:${event.eventType}:${event.summary}`);
        },
        renderResult(summary) {
            rendered.push(`result:${summary}`);
        },
    };
    let capturedRequest;
    const pipeline = {
        async launchTask(request) {
            capturedRequest = request;
            return "task-cli-1";
        },
    };
    const cli = new CLIService(parser, mapper, pipeline, traceViewer);
    const exitCode = await cli.run([
        "generate",
        "--module",
        "implementation",
        "--input",
        "module.md",
        "--workspace",
        "./demo",
    ]);
    assert.equal(exitCode, 0);
    assert.deepEqual(capturedRequest, {
        startStageId: "implementation",
        workspaceRoot: "./demo",
        inputArtifacts: {
            moduleDesign: "module.md",
        },
    });
    assert.deepEqual(rendered, [
        'trace:task_launch_requested:Launching command "generate" for stage "implementation".',
        "status:Task launched: task-cli-1",
        "result:Completed command: generate",
    ]);
}
async function testCliRunMissingWorkspace() {
    const parser = new DefaultCLICommandParser();
    const mapper = new DefaultCLIRequestMapper();
    const traceViewer = {
        renderStatus() { },
        renderTrace() { },
        renderResult() { },
    };
    const pipeline = {
        async launchTask() {
            return "task-cli-1";
        },
    };
    const cli = new CLIService(parser, mapper, pipeline, traceViewer);
    await assert.rejects(async () => cli.run(["generate", "--module", "implementation", "--input", "module.md"]), /Missing required option: --workspace/);
}
async function testReviewInteractionApply() {
    const reviewOutput = [];
    const reviewInteraction = new ConsoleReviewInteraction({
        async ask() {
            return "apply";
        },
        write(message) {
            reviewOutput.push(message);
        },
    });
    const decision = await reviewInteraction.waitForReview({
        reviewId: "review-1",
        summary: "Review generated changes.",
        changedFiles: [
            { path: "src/a.ts", operation: "update", content: "export const a = 1;\n" },
        ],
    });
    assert.deepEqual(decision, {
        action: "apply",
        summary: "User approved the change set.",
    });
    assert.equal(reviewOutput.some((line) => line.includes("Review generated changes.")), true);
}
async function testReviewInteractionReject() {
    const rejectInteraction = new ConsoleReviewInteraction({
        async ask() {
            return "reject";
        },
        write() { },
    });
    const rejectDecision = await rejectInteraction.waitForReview({
        reviewId: "review-2",
        summary: "Reject generated changes.",
        changedFiles: [],
    });
    assert.deepEqual(rejectDecision, {
        action: "reject",
        summary: "User rejected the change set.",
    });
}
async function testReviewInteractionComment() {
    const commentInteraction = new ConsoleReviewInteraction({
        async ask(prompt) {
            if (prompt.includes("Apply changes?")) {
                return "comment";
            }
            return "Please regenerate the service layer.";
        },
        write() { },
    });
    const commentDecision = await commentInteraction.waitForReview({
        reviewId: "review-3",
        summary: "Comment on generated changes.",
        changedFiles: [],
    });
    assert.deepEqual(commentDecision, {
        action: "wait",
        summary: "User requested changes before apply.",
        comment: "Please regenerate the service layer.",
    });
}
