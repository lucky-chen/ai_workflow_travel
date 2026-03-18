const statusLabels = {
  completed: "Completed",
  in_progress: "In Progress",
  pending: "Pending",
  other: "Other",
};

void bootstrap();

async function bootstrap() {
  const response = await fetch("/api/plan");
  if (!response.ok) {
    throw new Error(`Failed to load plan data: ${response.status}`);
  }

  const data = await response.json();
  renderDashboard(data);
}

function renderDashboard(data) {
  window.__WORK_PLAN_FOCUS__ = data.currentFocus || null;
  document.querySelector("#plan-name").textContent = data.planName;
  document.querySelector("#plan-target").textContent = data.target;
  document.querySelector("#plan-status").textContent = formatStatus(data.status);
  document.querySelector("#plan-status").dataset.status = data.status;

  document.querySelector("#top-summary").innerHTML = [
    renderSummaryCard("Stages", data.topSummary.stages),
    renderSummaryCard("Batches", data.topSummary.batches),
    renderSummaryCard("Tasks", data.topSummary.tasks),
  ].join("");

  document.querySelector("#current-focus").innerHTML = renderCurrentFocus(data.currentFocus);
  document.querySelector("#open-questions").innerHTML = renderStringList(data.openQuestions, "No open questions.");
  document.querySelector("#resolved-decisions").innerHTML = renderStringList(data.resolvedDecisions, "No resolved decisions.");
  document.querySelector("#stages").innerHTML = renderStageGroups(data.stages);
  bindCurrentFocusJump();
}

function renderSummaryCard(title, summary) {
  return `
    <article class="summary-card">
      <h3>${title}</h3>
      ${renderStatusRow(summary)}
    </article>
  `;
}

function renderStatusRow(summary) {
  return `
    <div class="status-row">
      ${Object.entries(summary).map(([key, value]) => `
        <span class="metric-pill" data-status="${key}">
          <strong>${value}</strong>
          <span>${statusLabels[key] || key}</span>
        </span>
      `).join("")}
    </div>
  `;
}

function renderCurrentFocus(currentFocus) {
  if (!currentFocus) {
    return `<p class="muted">No current focus.</p>`;
  }

  const targetId = currentFocus.taskId
    ? `task-${currentFocus.taskId}`
    : currentFocus.batchId
      ? `batch-${currentFocus.batchId}`
      : currentFocus.stageId
        ? `stage-${currentFocus.stageId}`
        : "";

  return `
    <div class="focus-path">
      <span>${currentFocus.milestoneName || currentFocus.milestoneId}</span>
      <span>${currentFocus.stageName || currentFocus.stageId}</span>
      <span>${currentFocus.batchName || currentFocus.batchId}</span>
    </div>
    <p class="focus-task">${currentFocus.taskId}</p>
    <div class="focus-actions">
      <span class="status-chip" data-status="${currentFocus.taskStatus || "other"}">${formatStatus(currentFocus.taskStatus || "other")}</span>
      <button class="focus-link-button" data-target-id="${targetId}">Jump To Detail</button>
    </div>
  `;
}

function renderStageGroups(stages) {
  const activeStages = stages.filter((stage) => stage.stageStatus !== "completed");
  const completedStages = stages.filter((stage) => stage.stageStatus === "completed");

  return `
    <section class="stage-group">
      <div class="group-header">
        <h3>Active Stages</h3>
        <span class="group-count">${activeStages.length}</span>
      </div>
      <div class="stage-stack">
        ${activeStages.length ? activeStages.map(renderStageCard).join("") : '<p class="muted">No active stages.</p>'}
      </div>
    </section>
    <details class="stage-group completed-group">
      <summary class="group-header">
        <span>Completed Stages</span>
        <span class="group-count">${completedStages.length}</span>
      </summary>
      <div class="stage-stack completed-stack">
        ${completedStages.length ? completedStages.map(renderStageCard).join("") : '<p class="muted">No completed stages.</p>'}
      </div>
    </details>
  `;
}

function renderStageCard(stage) {
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedStage = focus?.stageId === stage.stageId;

  return `
    <details class="stage-card" id="stage-${stage.stageId}" ${isFocusedStage ? "open" : ""}>
      <summary class="stage-header">
        <div>
          <p class="stage-meta">${stage.milestoneName || stage.milestoneId}</p>
          <h3>${stage.stageName || stage.stageId}</h3>
          <p class="stage-goal">${stage.goal}</p>
        </div>
        <span class="status-chip" data-status="${stage.stageStatus}">${formatStatus(stage.stageStatus)}</span>
      </summary>
      <div class="stage-summary">
        <div>
          <h4>Batch Summary</h4>
          ${renderStatusRow(stage.summary.batches)}
        </div>
        <div>
          <h4>Task Summary</h4>
          ${renderStatusRow(stage.summary.tasks)}
        </div>
      </div>
      <div class="batch-stack">
        ${stage.batches.map(renderBatchCard).join("")}
      </div>
    </details>
  `;
}

function renderBatchCard(batch) {
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedBatch = focus?.batchId === batch.batchId;

  return `
    <details class="batch-card" id="batch-${batch.batchId}" ${isFocusedBatch ? "open" : ""}>
      <summary class="batch-header">
        <div>
          <p class="batch-id">${batch.batchId}</p>
          <h4>${batch.batchName || batch.batchId}</h4>
          <p>${batch.goal}</p>
        </div>
        <span class="status-chip" data-status="${batch.batchStatus}">${formatStatus(batch.batchStatus)}</span>
      </summary>
      <div class="task-section-divider">
        <span>Tasks</span>
      </div>
      <div class="task-list">
        ${batch.tasks.map((task) => renderTaskCard(task)).join("")}
      </div>
    </details>
  `;
}

function renderTaskCard(task) {
  const involvedFiles = Array.isArray(task.involvedFiles) ? task.involvedFiles : [];
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedTask = focus?.taskId === task.taskId;

  return `
    <details class="task-card" id="task-${task.taskId}" ${isFocusedTask ? "open" : ""}>
      <summary class="task-summary-row">
        <div class="task-main">
          <p class="task-id">${task.taskId}</p>
          <p class="task-title">${task.summary}</p>
        </div>
        <span class="status-chip" data-status="${task.status}">${formatStatus(task.status)}</span>
      </summary>
      <div class="task-detail">
        <div class="task-detail-block">
          <p class="task-detail-label">Status</p>
          <p class="task-detail-copy">${formatStatus(task.status)}</p>
        </div>
        <div class="task-detail-block">
          <p class="task-detail-label">Involved Files</p>
          ${involvedFiles.length
            ? `<div class="task-file-list">${involvedFiles.map((file) => `<code>${escapeHtml(file)}</code>`).join("")}</div>`
            : `<p class="task-detail-copy muted">No involved files listed.</p>`}
        </div>
      </div>
    </details>
  `;
}

function renderStringList(items, emptyText) {
  if (!items.length) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return items.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("");
}

function formatStatus(status) {
  return (statusLabels[status] || status || "unknown").replaceAll("_", " ");
}

function bindCurrentFocusJump() {
  const button = document.querySelector(".focus-link-button");
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.addEventListener("click", () => {
    const targetId = button.dataset.targetId;
    if (!targetId) {
      return;
    }

    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    if (target instanceof HTMLDetailsElement) {
      target.open = true;
    }

    const batchCard = target.closest(".batch-card");
    if (batchCard instanceof HTMLDetailsElement) {
      batchCard.open = true;
    }

    const stageCard = target.closest(".stage-card");
    if (stageCard instanceof HTMLDetailsElement) {
      stageCard.open = true;
    }

    const completedGroup = target.closest(".completed-group");
    if (completedGroup instanceof HTMLDetailsElement) {
      completedGroup.open = true;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.classList.add("jump-highlight");
    window.setTimeout(() => target.classList.remove("jump-highlight"), 1800);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
