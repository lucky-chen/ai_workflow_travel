import path from "node:path";

import type {
  PermissionCheckInput,
  PermissionDecision,
  RuntimePermissionPolicy as RuntimePermissionPolicyContract,
} from "./types.js";

export class RuntimePermissionPolicy implements RuntimePermissionPolicyContract {
  constructor(private readonly defaultAllowedWorkingDirectories: string[] = []) {}

  async evaluate(input: PermissionCheckInput): Promise<PermissionDecision> {
    const workingDirectory = input.toolCall.workingDirectory;
    const allowlist = input.allowedWorkingDirectories
      ?? input.toolCall.allowedWorkingDirectories
      ?? this.defaultAllowedWorkingDirectories;

    if (!workingDirectory || allowlist.length === 0) {
      return { allowed: true };
    }

    const normalizedWorkingDirectory = path.resolve(workingDirectory);
    const allowed = allowlist.some((candidate) => {
      const normalizedCandidate = path.resolve(candidate);
      return normalizedWorkingDirectory === normalizedCandidate
        || normalizedWorkingDirectory.startsWith(`${normalizedCandidate}${path.sep}`);
    });

    if (allowed) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reasonCode: "WORKDIR_NOT_ALLOWED",
      message: `Working directory ${normalizedWorkingDirectory} is not allowed.`,
    };
  }
}
