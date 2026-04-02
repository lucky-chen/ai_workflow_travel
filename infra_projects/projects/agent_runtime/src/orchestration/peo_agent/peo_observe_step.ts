import type { AgentEvent, AgentRunInput } from "../../interface/agent-api.js";
import type { ObserveStepInput, PlanTask, Summary, TaskSummary } from "./peo_types.js";

interface TaskObservationResult {
  task: PlanTask;
  output: string;
  error: {
    code: number;
    message: string;
  };
}

type ObservationDecision = "success" | "replan";

export class ObserveStep {
  constructor(
    private readonly emitAgentEvent: (event: AgentEvent) => Promise<void>,
  ) {}

  async run(
    agentInput: AgentRunInput,
    runId: string,
    stepIndex: number,
    observeInput: ObserveStepInput,
  ): Promise<{
    summary: Summary;
    completed: boolean;
  }> {
    await this.emitAgentEvent({
      timestamp: new Date().toISOString(),
      brief: "peo.observation.input",
      details: {
        runId,
        agent: "peo",
        step: "observation",
        stepIndex,
        input: {
          planSummary: observeInput.plan.planSummary,
          tasks: observeInput.executionResult.tasks,
          taskResults: observeInput.executionResult.taskResults,
        },
      },
    });
    if (observeInput.executionResult.validationError) {
      return this.buildObservationOutput(
        {
          conclusion: {
            completedCount: 0,
            incompleteCount: 0,
            failedCount: 0,
          },
          validationError: observeInput.executionResult.validationError,
          tasks: [],
        },
        "replan",
      );
    }
    const taskResults = this.buildTaskObservationResults(observeInput);
    const summary = summarizeTaskResults(taskResults, observeInput.executionResult.validationError);
    const decision = this.decideObservationOutcome(taskResults, observeInput.executionResult.validationError);
    if (decision === "replan") {
      return this.buildObservationOutput(summary, "replan");
    }
    return this.buildObservationOutput(summary, "success");
  }

  private buildTaskObservationResults(observeInput: ObserveStepInput): TaskObservationResult[] {
    return observeInput.executionResult.tasks.map((task, index) => {
      const taskResult = observeInput.executionResult.taskResults[index];
      return {
        task,
        output: taskResult?.output ?? "",
        error: taskResult?.error ?? {
          code: 1,
          message: "",
        },
      };
    });
  }

  private decideObservationOutcome(
    taskResults: TaskObservationResult[],
    validationError?: string,
  ): ObservationDecision {
    if (validationError) {
      return "replan";
    }
    if (taskResults.length === 0) {
      return "success";
    }
    const failedTasks = taskResults.filter((task) => task.error.code !== 0);
    const incompleteTasks = taskResults.filter((task) => task.error.code === 0 && !task.output.trim());
    return failedTasks.length > 0 || incompleteTasks.length > 0 ? "replan" : "success";
  }

  private buildObservationOutput(
    summary: Summary,
    decision: ObservationDecision,
  ): {
    summary: Summary;
    completed: boolean;
  } {
    if (decision === "success") {
      return {
        summary,
        completed: true,
      };
    }
    return {
      summary,
      completed: false,
    };
  }
}

function summarizeTaskResults(taskResults: TaskObservationResult[], validationError?: string): Summary {
  const tasks: TaskSummary[] = taskResults.map((task) => {
    const status = task.error.code !== 0
      ? "failed"
      : task.output.trim()
        ? "completed"
        : "incomplete";
    return {
      name: task.task.name,
      description: task.task.description,
      status,
      reason: task.error.code !== 0 ? (task.error.message || "Task failed.") : undefined,
      output: task.output.trim() ? task.output : undefined,
    };
  });
  if (validationError) {
    tasks.unshift({
      name: "plan",
      description: "plan validation",
      status: "failed",
      reason: validationError,
    });
  }
  return {
    conclusion: {
      completedCount: tasks.filter((task) => task.status === "completed").length,
      incompleteCount: tasks.filter((task) => task.status === "incomplete").length,
      failedCount: tasks.filter((task) => task.status === "failed").length,
    },
    validationError,
    tasks,
  };
}
