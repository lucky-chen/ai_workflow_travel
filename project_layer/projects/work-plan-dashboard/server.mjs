import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "../sdlc/node_modules/yaml/dist/index.js";

const currentFilePath = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(currentFilePath);
const publicRoot = path.join(projectRoot, "public");
const planFilePath = path.resolve(projectRoot, "..", "..", "docs", "work_plan.yaml");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/api/plan") {
      const payload = await buildPlanPayload();
      return sendJson(response, 200, payload);
    }

    const targetPath = resolvePublicPath(requestUrl.pathname);
    const content = await readFile(targetPath);
    const extension = path.extname(targetPath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(content);
  } catch (error) {
    const nodeError = error;
    if (nodeError?.code === "ENOENT") {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }));
  }
});

server.listen(port, host, () => {
  process.stdout.write(`work-plan-dashboard listening on http://${host}:${port}\n`);
});

function resolvePublicPath(requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const targetPath = path.join(publicRoot, normalizedPath);
  const safeTargetPath = path.normalize(targetPath);
  if (!safeTargetPath.startsWith(publicRoot)) {
    const error = new Error("Invalid public path.");
    error.code = "ENOENT";
    throw error;
  }
  return safeTargetPath;
}

async function buildPlanPayload() {
  const raw = await readFile(planFilePath, "utf8");
  const plan = YAML.parse(raw);
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  const stageItems = milestones.flatMap((milestone) =>
    (Array.isArray(milestone.stages) ? milestone.stages : []).map((stage) => ({
      milestoneId: milestone.milestone_id,
      milestoneName: milestone.name,
      stageId: stage.stage_id,
      stageStatus: stage.status,
      goal: stage.goal,
      deliveredFeature: stage.delivered_feature || null,
      featureScope: Array.isArray(stage.feature_scope) ? stage.feature_scope : [],
      batches: (Array.isArray(stage.batches) ? stage.batches : []).map((batch) => ({
        batchId: batch.batch_id,
        batchType: batch.batch_type || null,
        batchName: batch.name,
        batchStatus: batch.status,
        goal: batch.goal,
        covers: Array.isArray(batch.covers) ? batch.covers : [],
        tasks: (Array.isArray(batch.tasks) ? batch.tasks : []).map((task) => ({
          taskName: task.task_name || task.task_id || null,
          summary: task.summary,
          status: task.status,
          involvedFiles: task.involved_files || [],
        })),
      })),
    })),
  );

  return {
    planName: plan.plan_name,
    target: plan.target,
    status: plan.status,
    currentFocus: resolveCurrentFocus(plan.workflow?.current_focus, stageItems),
    topSummary: buildTopSummary(stageItems),
    stages: stageItems.map((stage) => ({
      ...stage,
      summary: summarizeStage(stage),
    })),
    openQuestions: Array.isArray(plan.governance?.decisions?.open) ? plan.governance.decisions.open : [],
    resolvedDecisions: Array.isArray(plan.governance?.decisions?.resolved) ? plan.governance.decisions.resolved : [],
  };
}

function buildTopSummary(stages) {
  const summary = {
    stages: createStatusCounter(),
    batches: createStatusCounter(),
    tasks: createStatusCounter(),
  };

  for (const stage of stages) {
    bumpStatus(summary.stages, stage.stageStatus);
    for (const batch of stage.batches) {
      bumpStatus(summary.batches, batch.batchStatus);
      for (const task of batch.tasks) {
        bumpStatus(summary.tasks, task.status);
      }
    }
  }

  return summary;
}

function summarizeStage(stage) {
  const batchSummary = createStatusCounter();
  const taskSummary = createStatusCounter();

  for (const batch of stage.batches) {
    bumpStatus(batchSummary, batch.batchStatus);
    for (const task of batch.tasks) {
      bumpStatus(taskSummary, task.status);
    }
  }

  return {
    batches: batchSummary,
    tasks: taskSummary,
  };
}

function resolveCurrentFocus(currentFocus, stages) {
  if (!currentFocus) {
    return null;
  }

  const targetStage = stages.find((stage) => stage.stageId === currentFocus.stage_id);
  const targetBatch = targetStage?.batches.find((batch) => batch.batchId === currentFocus.batch_id);
  const targetTask = targetBatch?.tasks.find((task) => task.taskName === currentFocus.task_name);

  return {
    milestoneId: currentFocus.milestone_id,
    stageId: currentFocus.stage_id,
    batchId: currentFocus.batch_id,
    taskName: currentFocus.task_name,
    milestoneName: targetStage?.milestoneName || null,
    batchName: targetBatch?.batchName || null,
    taskSummary: targetTask?.summary || null,
    taskStatus: targetTask?.status || null,
  };
}

function createStatusCounter() {
  return {
    completed: 0,
    in_progress: 0,
    pending: 0,
    other: 0,
  };
}

function bumpStatus(counter, status) {
  if (status === "completed" || status === "in_progress" || status === "pending") {
    counter[status] += 1;
    return;
  }
  counter.other += 1;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}
