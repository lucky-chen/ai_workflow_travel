import type {
  ContractCheckResult,
  ContractIssue,
  ExecutionUnitResult,
  ExecutionContext,
} from "../../Runtime/Unit/execution-unit.js";
import { getArtifactValue } from "../../Runtime/Unit/execution-unit.js";
import { normalizeUserPromptContent, type LlmExecutionRequest } from "../../SDK/AgentRuntime/LlmExecutor/llm-executor.js";
import type { ContractExecutionResult, ContractSpec } from "../../Capability/Shared/document-unit-contract.js";
import { DocumentUnitContract } from "../../Capability/Shared/document-unit-contract.js";
import { parse as parseYaml } from "yaml";

interface ParsedWorkPlanDocument {
  version: number;
  plan_name: string;
  target: string;
  sources: Record<string, unknown>;
  principles: string[];
  execution_scope: string;
  status: string;
  current_focus: {
    milestone_id: string;
    stage_id: string;
    batch_id: string;
    task_id: string;
  };
  milestones: ParsedWorkPlanMilestone[];
}

interface ParsedWorkPlanMilestone {
  milestone_id: string;
  name: string;
  goal: string;
  status: string;
  stages: ParsedWorkPlanStage[];
}

interface ParsedWorkPlanStage {
  stage_id: string;
  name: string;
  goal: string;
  status: string;
  batches: ParsedWorkPlanBatch[];
}

interface ParsedWorkPlanBatch {
  batch_id: string;
  name: string;
  goal: string;
  status: string;
  tasks: ParsedWorkPlanTask[];
}

interface ParsedWorkPlanTask {
  task_id: string;
  summary: string;
  status: string;
}

interface WorkPlanArtifacts {
  artifactKey: "work_plan";
  content: string;
}

export class WorkPlanContract extends DocumentUnitContract {
  protected getContractResourcePath(): string {
    return "contract/WorkPlanTemplate.contract.json";
  }

  protected getExecutionUnitId(): string {
    return "work_plan";
  }

  protected async buildCheckRequest(
    context: ExecutionContext,
    output: ExecutionUnitResult,
    contractSpec: ContractSpec,
  ): Promise<LlmExecutionRequest> {
    const workPlanOutput = output as ExecutionUnitResult<WorkPlanArtifacts>;
    const generatedResult = workPlanOutput.artifacts.content.trim();
    const itemDesignDocuments = this.parseItemDesignDocuments(
      getArtifactValue(context.inputArtifacts, "item_design_documents"),
    );

    return {
      prompt: {
        systemPrompt:
          "You check whether a yaml work plan satisfies the provided contract spec. " +
          "Return JSON with passed, summary, and issues only.",
        userPrompt: {
          target: "work_plan_contract_check",
          generatedResult,
          contractSpec,
          upstreamContext: {
            requirement_design: getArtifactValue(context.inputArtifacts, "requirement_design"),
            architecture_design: getArtifactValue(context.inputArtifacts, "architecture_design"),
            item_design_documents: itemDesignDocuments,
          },
          requiredOutputShape: {
            passed: "boolean",
            summary: "string",
            issues: [
              {
                checkItem: "string",
                message: "string",
                severity: "low | medium | high",
              },
            ],
          },
        },
      },
      responseFormat: "json",
      metadata: {
        executionUnit: "work_plan_contract",
        checkType: "contract",
      },
    };
  }

  protected buildContractResult(result: ContractExecutionResult): ContractCheckResult {
    return {
      passed: result.passed,
      summary: result.summary,
      issues: result.issues,
    };
  }

  protected checkAgainstPromptRequest(request: LlmExecutionRequest): ContractExecutionResult {
    const promptPayload = JSON.parse(normalizeUserPromptContent(request.prompt.userPrompt)) as {
      generatedResult: string;
      contractSpec: ContractSpec;
    };
    const content = promptPayload.generatedResult;
    const contractSpec = promptPayload.contractSpec;
    const issues: ContractIssue[] = [];

    if (content.length === 0) {
      issues.push({
        checkItem: "work_plan_not_empty",
        message: "Work plan content must not be empty.",
        severity: "high",
      });
    }

    const parsedPlan = this.parseWorkPlan(content, issues);
    if (parsedPlan) {
      this.collectTopLevelStructureIssues(parsedPlan, contractSpec, issues);
      this.collectFocusIssues(parsedPlan, contractSpec, issues);
      this.collectMilestoneStageBatchTaskIssues(parsedPlan, contractSpec, issues);
    }

    return {
      passed: issues.length === 0,
      summary: issues.length === 0
        ? "Work plan passed contract checks."
        : "Work plan failed contract checks.",
      issues,
    };
  }

  private parseItemDesignDocuments(rawValue: string | undefined): string[] {
    if (!rawValue) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return [];
    }

    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
      return [];
    }

    return parsed;
  }

  private parseWorkPlan(content: string, issues: ContractIssue[]): ParsedWorkPlanDocument | null {
    let parsed: unknown;
    try {
      parsed = parseYaml(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push({
        checkItem: "yaml_work_plan_structure_complete",
        message: `Work plan must be valid yaml. ${message}`,
        severity: "high",
      });
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      issues.push({
        checkItem: "yaml_work_plan_structure_complete",
        message: "Work plan yaml must parse to an object.",
        severity: "high",
      });
      return null;
    }

    return parsed as ParsedWorkPlanDocument;
  }

  private collectTopLevelStructureIssues(
    content: ParsedWorkPlanDocument,
    contractSpec: ContractSpec,
    issues: ContractIssue[],
  ): void {
    const structureContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "yaml_work_plan_structure_complete",
    );

    if (typeof content.version !== "number") {
      this.pushIssue(issues, structureContract, "Missing required top-level key: version");
    }
    if (typeof content.plan_name !== "string" || content.plan_name.length === 0) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: plan_name");
    }
    if (typeof content.target !== "string" || content.target.length === 0) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: target");
    }
    if (!content.sources || typeof content.sources !== "object" || Array.isArray(content.sources)) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: sources");
    }
    if (!Array.isArray(content.principles) || content.principles.some((entry) => typeof entry !== "string")) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: principles");
    }
    if (typeof content.execution_scope !== "string" || content.execution_scope.length === 0) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: execution_scope");
    }
    if (typeof content.status !== "string" || content.status.length === 0) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: status");
    }
    if (!content.current_focus || typeof content.current_focus !== "object") {
      this.pushIssue(issues, structureContract, "Missing required top-level key: current_focus");
    }
    if (!Array.isArray(content.milestones)) {
      this.pushIssue(issues, structureContract, "Missing required top-level key: milestones");
    }
  }

  private collectFocusIssues(
    content: ParsedWorkPlanDocument,
    contractSpec: ContractSpec,
    issues: ContractIssue[],
  ): void {
    const focusContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "yaml_work_plan_focus_consistency",
    );

    if (!content.current_focus || typeof content.current_focus.milestone_id !== "string" || content.current_focus.milestone_id.length === 0) {
      this.pushIssue(issues, focusContract, "current_focus should include milestone_id");
    }
    if (!content.current_focus || typeof content.current_focus.stage_id !== "string" || content.current_focus.stage_id.length === 0) {
      this.pushIssue(issues, focusContract, "current_focus should include stage_id");
    }
    if (!content.current_focus || typeof content.current_focus.batch_id !== "string" || content.current_focus.batch_id.length === 0) {
      this.pushIssue(issues, focusContract, "current_focus should include batch_id");
    }
    if (!content.current_focus || typeof content.current_focus.task_id !== "string" || content.current_focus.task_id.length === 0) {
      this.pushIssue(issues, focusContract, "current_focus should include task_id");
    }
  }

  private collectMilestoneStageBatchTaskIssues(
    content: ParsedWorkPlanDocument,
    contractSpec: ContractSpec,
    issues: ContractIssue[],
  ): void {
    const taskContract = contractSpec.document_contracts.find(
      (entry) => entry.check_item === "yaml_work_plan_task_structure",
    );

    if (!Array.isArray(content.milestones) || content.milestones.length === 0) {
      this.pushIssue(issues, taskContract, "Work plan should define at least one milestone entry under milestones.");
      return;
    }

    if (content.milestones.some((milestone) => typeof milestone.milestone_id !== "string" || milestone.milestone_id.length === 0)) {
      this.pushIssue(issues, taskContract, "Each milestone should include milestone_id.");
    }

    if (content.milestones.some((milestone) => !Array.isArray(milestone.stages) || milestone.stages.length === 0)) {
      this.pushIssue(issues, taskContract, "Work plan should define at least one stage entry under milestones.");
    }

    const stages = content.milestones.flatMap((milestone) => Array.isArray(milestone.stages) ? milestone.stages : []);
    if (stages.some((stage) => typeof stage.stage_id !== "string" || stage.stage_id.length === 0)) {
      this.pushIssue(issues, taskContract, "Each stage should include stage_id.");
    }

    if (stages.some((stage) => !Array.isArray(stage.batches) || stage.batches.length === 0)) {
      this.pushIssue(issues, taskContract, "Work plan should define at least one batch entry under stages.");
    }

    const batches = stages.flatMap((stage) => Array.isArray(stage.batches) ? stage.batches : []);
    if (batches.some((batch) => typeof batch.batch_id !== "string" || batch.batch_id.length === 0)) {
      this.pushIssue(issues, taskContract, "Each batch should include batch_id.");
    }

    if (batches.some((batch) => !Array.isArray(batch.tasks) || batch.tasks.length === 0)) {
      this.pushIssue(issues, taskContract, "Work plan should define at least one task entry under batches.");
    }

    const tasks = batches.flatMap((batch) => Array.isArray(batch.tasks) ? batch.tasks : []);
    if (tasks.some((task) => typeof task.task_id !== "string" || task.task_id.length === 0)) {
      this.pushIssue(issues, taskContract, "Each task should include task_id.");
    }
    if (tasks.some((task) => typeof task.summary !== "string" || task.summary.length === 0)) {
      this.pushIssue(issues, taskContract, "Each task should include a summary field.");
    }
    if (tasks.some((task) => !this.isNormalizedStatus(task.status))) {
      this.pushIssue(issues, taskContract, "Each task should include a normalized status field.");
    }
  }

  private isNormalizedStatus(value: unknown): value is "pending" | "in_progress" | "completed" {
    return value === "pending" || value === "in_progress" || value === "completed";
  }

  private pushIssue(
    issues: ContractIssue[],
    contract: ContractSpec["document_contracts"][number] | undefined,
    message: string,
  ): void {
    issues.push({
      checkItem: contract?.check_item ?? "yaml_work_plan_structure",
      message,
      severity: contract?.severity ?? "high",
    });
  }
}
