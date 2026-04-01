import assert from "node:assert/strict";

import {
  createTerminalSessionDemo,
  toRuntimeEventDisplay,
} from "../src_new/application/terminal-session-demo.js";
import { createRuntime } from "../src_new/runtime/runtime.js";
import { createTestWorkdir } from "./test-workdir.js";

export async function runApplicationP1SrcNewTests(): Promise<void> {
  await testTerminalDemoCreateExecuteClose();
  await testTerminalDemoOpenExistingSession();
  await testRuntimeEventDisplayMapping();
}

async function testTerminalDemoCreateExecuteClose(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-app-create-");
  const outputs: string[] = [];
  const runtime = createRuntime({ workdir });
  const demo = createTerminalSessionDemo({
    runtime,
    readInput: async () => {
      const next = outputs.length === 0 ? "hello demo" : "";
      return {
        rawText: next,
        closeRequested: outputs.length > 0,
      };
    },
    writeLine: async (line) => {
      outputs.push(line);
    },
  });

  const result = await demo.run({
    runtime,
  });

  assert.equal(typeof result.sessionId, "string");
  assert.equal(outputs.some((line) => line.includes("Session closed:")), true);
}

async function testTerminalDemoOpenExistingSession(): Promise<void> {
  const workdir = await createTestWorkdir("agent-runtime-p1-app-open-");
  const runtime = createRuntime({ workdir });
  const session = await runtime.createSession({
    config: {
      model: {
        mock: true,
        mockInfo: {
          content: "existing assistant output",
        },
      },
    },
  });
  await session.execute({
    content: {
      task: "what is seed history",
    },
  });
  const state = await session.load();
  const outputs: string[] = [];
  const demo = createTerminalSessionDemo({
    runtime,
    sessionId: state.sessionId,
    readInput: async () => ({
      rawText: "",
      closeRequested: true,
    }),
    writeLine: async (line) => {
      outputs.push(line);
    },
  });

  const result = await demo.run({
    runtime,
    sessionId: state.sessionId,
  });

  assert.equal(result.sessionId, state.sessionId);
  assert.equal(outputs.includes("[assistant] existing assistant output"), true);
  assert.equal(outputs.at(-1), `Session closed: ${state.sessionId}`);
}

async function testRuntimeEventDisplayMapping(): Promise<void> {
  const reactDisplay = toRuntimeEventDisplay({
    type: "model_started",
    metadata: {
      timestamp: new Date().toISOString(),
    },
    agent: {
      name: "react",
      react: {
        step: "thought",
        stepIndex: 1,
      },
    },
  });
  const peoDisplay = toRuntimeEventDisplay({
    type: "task_selected",
    metadata: {
      timestamp: new Date().toISOString(),
    },
    agent: {
      name: "peo",
      peo: {
        step: "task_execution",
        stepIndex: 1,
        taskId: "task-1",
        taskType: "react",
      },
    },
  });
  const toolDisplay = toRuntimeEventDisplay({
    type: "tool_started",
    metadata: {
      timestamp: new Date().toISOString(),
    },
    agent: {
      name: "react",
      react: {
        step: "action",
        stepIndex: 1,
        actionType: "tool",
      },
      tool: {
        toolName: "read_text_file",
      },
    },
  });

  assert.equal(reactDisplay.title, "React thought started");
  assert.equal(peoDisplay.title, "Task selected: task-1");
  assert.equal(peoDisplay.detail, "react");
  assert.equal(toolDisplay.title, "Tool started: read_text_file");
}
