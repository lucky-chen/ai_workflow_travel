<!--
{
  "document_contracts": [
    {
      "check_item": "document_structure_complete",
      "description": "The document should contain the required runtime guide sections, subsection structure, and reusable template placeholders.",
      "severity": "high"
    },
    {
      "check_item": "runtime_level_consistency",
      "description": "The document should stay at lightweight runtime and basic operations level and should not drift into full-scale production operations detail.",
      "severity": "high"
    },
    {
      "check_item": "template_reusability",
      "description": "The document should remain generic enough to be reused across early-stage projects with minimal edits.",
      "severity": "high"
    }
  ]
}
-->

# Runtime Guide Template

## 1. Purpose

<!--
{
  "section_contract": {
    "section_id": "1",
    "title": "Purpose",
    "checkitems": [
      "state the purpose of the runtime guide in one short sentence",
      "list the main readers and why they should read it",
      "keep the content at lightweight runtime and troubleshooting level"
    ],
    "severity": "medium",
    "expected_format": "Define the minimum runtime and maintenance guide of the `{ProjectName}` project.\n\n- Team members: understand how to start, stop, and inspect the project.\n- Engineers: align on environment setup, file locations, and common troubleshooting.\n- Reviewers or operators: verify the project can be run and updated in a consistent way."
  }
}
-->

Define the minimum runtime and maintenance guide of the `{ProjectName}` project.

- Team members: understand how to start, stop, and inspect the project.
- Engineers: align on environment setup, file locations, and common troubleshooting.
- Reviewers or operators: verify the project can be run and updated in a consistent way.

## 2. Scope

<!--
{
  "section_contract": {
    "section_id": "2",
    "title": "Scope",
    "checkitems": [
      "define what runtime concerns this document covers",
      "define what this document does not cover",
      "clarify the boundary between lightweight runtime guidance and full deployment operations"
    ],
    "severity": "medium"
  }
}
-->

### 2.1 In Scope

<!--
{
  "section_contract": {
    "section_id": "2.1",
    "title": "In Scope",
    "checkitems": [
      "list only lightweight runtime concerns",
      "cover startup, shutdown, required configuration, local data locations, and common troubleshooting"
    ],
    "severity": "medium",
    "expected_format": "- Runtime prerequisites and environment setup.\n- Start, stop, and restart commands.\n- Important files, logs, and data directories.\n- Common troubleshooting paths.\n- Lightweight release or update steps."
  }
}
-->

- Runtime prerequisites and environment setup.
- Start, stop, and restart commands.
- Important files, logs, and data directories.
- Common troubleshooting paths.
- Lightweight release or update steps.

### 2.2 Out of Scope

<!--
{
  "section_contract": {
    "section_id": "2.2",
    "title": "Out of Scope",
    "checkitems": [
      "exclude full production topology and detailed operations policy",
      "exclude implementation internals unless they affect runtime usage"
    ],
    "severity": "medium",
    "expected_format": "- Detailed module internals.\n- Full multi-environment deployment architecture.\n- Formal incident management or on-call policy.\n- Detailed monitoring, backup, and disaster recovery procedures."
  }
}
-->

- Detailed module internals.
- Full multi-environment deployment architecture.
- Formal incident management or on-call policy.
- Detailed monitoring, backup, and disaster recovery procedures.

## 3. Runtime Overview

<!--
{
  "section_contract": {
    "section_id": "3",
    "title": "Runtime Overview",
    "checkitems": [
      "describe the minimum runnable shape of the project",
      "identify the main processes, commands, or entry points",
      "keep the section understandable for new contributors"
    ],
    "severity": "high",
    "expected_format": "- Entry point: `{EntryPoint}`.\n- Main runtime parts: `{RuntimePartA}`, `{RuntimePartB}`.\n- Minimum runnable mode: `{MinimumRunnableMode}`."
  }
}
-->

- Entry point: `{EntryPoint}`.
- Main runtime parts: `{RuntimePartA}`, `{RuntimePartB}`.
- Minimum runnable mode: `{MinimumRunnableMode}`.

## 4. Environment Requirements

<!--
{
  "section_contract": {
    "section_id": "4",
    "title": "Environment Requirements",
    "checkitems": [
      "list the required runtimes and external dependencies",
      "list the required environment variables or config files",
      "state the minimum assumptions needed to run the project"
    ],
    "severity": "high",
    "expected_format": "- Runtime version: `{RuntimeVersion}`.\n- Required tools: `{ToolA}`, `{ToolB}`.\n- Required environment variables: `{EnvVarList}`.\n- Required local services or remote dependencies: `{DependencyList}`."
  }
}
-->

- Runtime version: `{RuntimeVersion}`.
- Required tools: `{ToolA}`, `{ToolB}`.
- Required environment variables: `{EnvVarList}`.
- Required local services or remote dependencies: `{DependencyList}`.

## 5. Start And Stop

<!--
{
  "section_contract": {
    "section_id": "5",
    "title": "Start And Stop",
    "checkitems": [
      "provide the minimum commands to start and stop the project",
      "state any important ordering rules",
      "keep the commands easy to copy and use"
    ],
    "severity": "high"
  }
}
-->

### 5.1 Start

```sh
{StartCommand}
```

Notes:

- `{StartNote1}`
- `{StartNote2}`

### 5.2 Stop

```sh
{StopCommand}
```

Notes:

- `{StopNote1}`

### 5.3 Restart

```sh
{RestartCommand}
```

## 6. Files And Data

<!--
{
  "section_contract": {
    "section_id": "6",
    "title": "Files And Data",
    "checkitems": [
      "state where important generated files, logs, or temporary files live",
      "state which paths are safe to clean",
      "state which paths should be preserved"
    ],
    "severity": "medium",
    "expected_format": "- Config path: `{ConfigPath}`.\n- Log path: `{LogPath}`.\n- Generated output path: `{OutputPath}`.\n- Temporary path: `{TempPath}`.\n- Cleanup rule: `{CleanupRule}`."
  }
}
-->

- Config path: `{ConfigPath}`.
- Log path: `{LogPath}`.
- Generated output path: `{OutputPath}`.
- Temporary path: `{TempPath}`.
- Cleanup rule: `{CleanupRule}`.

## 7. Health Check

<!--
{
  "section_contract": {
    "section_id": "7",
    "title": "Health Check",
    "checkitems": [
      "define the minimum checks that confirm the project is running",
      "include a manual check path if no automated check exists"
    ],
    "severity": "medium",
    "expected_format": "- Automated health check: `{HealthCheckCommandOrUrl}`.\n- Manual verification: `{ManualVerificationStep}`.\n- Expected healthy result: `{HealthyResult}`."
  }
}
-->

- Automated health check: `{HealthCheckCommandOrUrl}`.
- Manual verification: `{ManualVerificationStep}`.
- Expected healthy result: `{HealthyResult}`.

## 8. Common Problems

<!--
{
  "section_contract": {
    "section_id": "8",
    "title": "Common Problems",
    "checkitems": [
      "list a small number of likely runtime issues",
      "provide the first useful troubleshooting step for each issue",
      "keep the guidance practical and brief"
    ],
    "severity": "medium",
    "expected_format": "### 8.x `{ProblemName}`\n- Symptom: `{Symptom}`.\n- Check: `{FirstCheck}`.\n- Action: `{Action}`."
  }
}
-->

### 8.1 `{ProblemName1}`

- Symptom: `{Symptom1}`.
- Check: `{FirstCheck1}`.
- Action: `{Action1}`.

### 8.2 `{ProblemName2}`

- Symptom: `{Symptom2}`.
- Check: `{FirstCheck2}`.
- Action: `{Action2}`.

## 9. Update And Release

<!--
{
  "section_contract": {
    "section_id": "9",
    "title": "Update And Release",
    "checkitems": [
      "define the minimum update steps for early-stage projects",
      "define a simple rollback path",
      "keep the process lightweight and realistic"
    ],
    "severity": "medium",
    "expected_format": "- Update steps: `{UpdateSteps}`.\n- Verification after update: `{PostUpdateVerification}`.\n- Rollback path: `{RollbackPath}`."
  }
}
-->

- Update steps: `{UpdateSteps}`.
- Verification after update: `{PostUpdateVerification}`.
- Rollback path: `{RollbackPath}`.

## 10. Ownership And Update Rules

<!--
{
  "section_contract": {
    "section_id": "10",
    "title": "Ownership And Update Rules",
    "checkitems": [
      "state who owns the runtime guide",
      "state when it must be updated",
      "keep the update triggers simple and actionable"
    ],
    "severity": "medium",
    "expected_format": "- Owner: `{Owner}`.\n- Update triggers: `{TriggerA}`, `{TriggerB}`.\n- Review cadence: `{Cadence}`."
  }
}
-->

- Owner: `{Owner}`.
- Update triggers: `{TriggerA}`, `{TriggerB}`.
- Review cadence: `{Cadence}`.

## 11. Open Risks

<!--
{
  "section_contract": {
    "section_id": "11",
    "title": "Open Risks",
    "checkitems": [
      "list unresolved runtime or maintenance risks",
      "keep each risk short and relevant to project operation"
    ],
    "severity": "medium",
    "expected_format": "- `{Risk1}`\n- `{Risk2}`"
  }
}
-->

- `{Risk1}`
- `{Risk2}`
