#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPO_ROOT="$(cd "$WORKSPACE_ROOT/../.." && pwd)"
LOG_DIR="$WORKSPACE_ROOT/dist/shell"
STDOUT_LOG="$LOG_DIR/requirement.stdout.log"
STDERR_LOG="$LOG_DIR/requirement.stderr.log"

cd "$REPO_ROOT"
mkdir -p "$LOG_DIR"
node project_layer/projects/sdlc/bin/sdlc.js generate --stage requirement_interpretation --workspace "$WORKSPACE_ROOT" --single-step \
  > >(tee "$STDOUT_LOG") \
  2> >(tee "$STDERR_LOG" >&2)
