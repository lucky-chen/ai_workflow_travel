import path from "node:path";

import type {
  PermissionCheckInput,
  PermissionDecision,
  RuntimePermissionPolicy as RuntimePermissionPolicyContract,
} from "./types.js";

export class RuntimePermissionPolicy implements RuntimePermissionPolicyContract {
  constructor(
    private readonly workingDirectory?: string,
    private readonly defaultAllowedWorkingDirectories: string[] = [],
  ) {}

  evaluate(_input: PermissionCheckInput): Promise<PermissionDecision> {
    void _input;
    const workingDirectory = this.workingDirectory;
    const allowlist = this.defaultAllowedWorkingDirectories;

    if (!workingDirectory || allowlist.length === 0) {
      return Promise.resolve({ allowed: true });
    }

    const normalizedWorkingDirectory = path.resolve(workingDirectory);
    const allowed = allowlist.some((candidate) => {
      const normalizedCandidate = path.resolve(candidate);
      return normalizedWorkingDirectory === normalizedCandidate
        || normalizedWorkingDirectory.startsWith(`${normalizedCandidate}${path.sep}`);
    });

    if (allowed) {
      return Promise.resolve({ allowed: true });
    }

    return Promise.resolve({
      allowed: false,
      reasonCode: "WORKDIR_NOT_ALLOWED",
      message: `Working directory ${normalizedWorkingDirectory} is not allowed.`,
    });
  }
}
