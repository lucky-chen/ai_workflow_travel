import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StageOutput } from "../../shared/contracts/pipeline.js";
import type { ITraceRecorder } from "../../shared/contracts/pipeline.js";
import type { ArtifactMap } from "../../shared/types/common.js";
import type { ILlmExecutor, LlmExecutionRequest, LlmExecutionResult } from "../../sdk/llm-executor/llm-executor.js";
import { DocumentStageGenerator } from "./document-stage-generator.js";

const TECHNICAL_ARCHITECTURE_TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "..",
  "meta_layer",
  "resources",
  "template",
  "TechnicalArchitectureTemplate.md",
);

export interface ArchitectureDesignArtifacts {
  artifactKey: "architecture_document";
  content: string;
}

export interface ArchitectureDesignGeneratorDependencies {
  llmExecutor: ILlmExecutor;
  traceRecorder?: ITraceRecorder;
}

export class ArchitectureDesignGenerator extends DocumentStageGenerator {
  constructor(dependencies: ArchitectureDesignGeneratorDependencies) {
    super(dependencies.llmExecutor, dependencies.traceRecorder);
  }

  protected async loadInputDocument(inputArtifacts: ArtifactMap): Promise<string> {
    const inputDocument = inputArtifacts.requirement_document;
    if (!inputDocument) {
      throw new Error('Missing required input artifact "requirement_document".');
    }

    return inputDocument;
  }

  protected async loadTemplate(): Promise<string> {
    return readFile(TECHNICAL_ARCHITECTURE_TEMPLATE_PATH, "utf8");
  }

  protected buildPrompt(inputDocument: string, template: string): LlmExecutionRequest {
    return {
      prompt: {
        systemPrompt:
          "You generate a technical architecture document that follows the provided template structure. " +
          "Return plain markdown only.",
        userPrompt: JSON.stringify(
          {
            target: "architecture_design",
            inputDocument,
            template,
          },
          null,
          2,
        ),
      },
      responseFormat: "text",
      metadata: {
        stage: "architecture_design",
      },
    };
  }

  protected async buildStageOutput(result: LlmExecutionResult): Promise<StageOutput<ArchitectureDesignArtifacts>> {
    return {
      stageId: "architecture_design",
      success: true,
      summary: "Architecture design document generated.",
      artifacts: {
        artifactKey: "architecture_document",
        content: result.content,
      },
    };
  }
}
