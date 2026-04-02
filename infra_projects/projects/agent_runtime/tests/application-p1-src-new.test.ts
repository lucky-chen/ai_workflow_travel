import assert from "node:assert/strict";

import {
  createTerminalSessionDemo,
  toRuntimeEventDisplay,
} from "../src_new/application/terminal-session-demo.js";
import { createRuntime } from "../src_new/interface/api.js";
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
    type: "model",
    modelMessage: {
      event: "model_started",
      timestamp: new Date().toISOString(),
      request: {
        responseFormat: "json",
        userPrompt: { stage: "react_thought" },
        stream: false,
        systemPromptCount: 1,
      },
    },
  });
  const reactStepDisplay = toRuntimeEventDisplay({
    type: "agent",
    agentMessage: {
      event: "step",
      timestamp: new Date().toISOString(),
      agent: {
        name: "react",
        content: {
          step: "thought",
          stepIndex: 1,
          input: {},
        },
      },
    },
  });
  const peoDisplay = toRuntimeEventDisplay({
    type: "agent",
    agentMessage: {
      event: "step",
      timestamp: new Date().toISOString(),
      agent: {
        name: "peo",
        content: {
          step: "execution",
          stepIndex: 1,
          input: {
            tasks: [{ taskId: "task-1", type: "react" }],
          },
        },
      },
    },
  });
  const toolDisplay = toRuntimeEventDisplay({
    type: "tool",
    toolMessage: {
      event: "tool_started",
      timestamp: new Date().toISOString(),
      agent: {
        name: "react",
        content: {
          step: "action",
          stepIndex: 1,
          input: {},
        },
      },
      tool: {
        toolName: "read_text_file",
      },
    },
  });

  assert.equal(reactDisplay.title, "Model started");
  assert.equal(reactStepDisplay.title, "React thought");
  assert.equal(peoDisplay.title, "PEO execution");
  assert.equal(toolDisplay.title, "Tool started: read_text_file");
}
