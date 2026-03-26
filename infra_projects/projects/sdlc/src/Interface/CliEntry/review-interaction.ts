import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { GateDecision } from "../../SDK/QualityControl/Gate/change-gate.js";
import type { IReviewInteraction, ReviewSession } from "./cli-types.js";

export interface ReviewPromptAdapter {
  ask(prompt: string): Promise<string>;
  write(message: string): void;
}

export class ConsoleReviewInteraction implements IReviewInteraction {
  constructor(private readonly promptAdapter: ReviewPromptAdapter = new ReadlinePromptAdapter()) {}

  async waitForReview(reviewSession: ReviewSession): Promise<GateDecision> {
    this.promptAdapter.write(`Review ${reviewSession.reviewId}: ${reviewSession.summary}\n`);
    if (reviewSession.changedPaths.length > 0) {
      this.promptAdapter.write(`Changed paths: ${reviewSession.changedPaths.join(", ")}\n`);
    }
    for (const changedFile of reviewSession.changedFiles) {
      this.promptAdapter.write(
        `- ${changedFile.operation} ${changedFile.path}${changedFile.content ? "\n" + changedFile.content : ""}\n`,
      );
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

class ReadlinePromptAdapter implements ReviewPromptAdapter {
  async ask(prompt: string): Promise<string> {
    const rl = createInterface({ input, output });
    try {
      return await rl.question(prompt);
    } finally {
      rl.close();
    }
  }

  write(message: string): void {
    output.write(message);
  }
}
