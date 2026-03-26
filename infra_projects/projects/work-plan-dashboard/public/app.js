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
  window.__WORK_PLAN_DATA__ = data;
  window.__WORK_PLAN_SELECTED_MILESTONE__ = data.currentFocus?.milestoneId || "all";
  window.__WORK_PLAN_SELECTED_STAGE__ = data.currentFocus?.stageId || null;
  bindMilestoneFilter();
  renderDashboard();
}

function renderDashboard() {
  const data = window.__WORK_PLAN_DATA__;
  if (!data) {
    return;
  }
  const selectedMilestoneId = window.__WORK_PLAN_SELECTED_MILESTONE__ || "all";
  const filteredStages = filterStagesByMilestone(data.stages, selectedMilestoneId);
  const filteredSummary = buildTopSummary(filteredStages);
  const milestoneOptions = buildMilestoneOptions(data.stages);
  const selectedMilestone = milestoneOptions.find((item) => item.id === selectedMilestoneId);
  const selectedStage = resolveSelectedStage(filteredStages);

  window.__WORK_PLAN_FOCUS__ = data.currentFocus || null;
  document.querySelector("#plan-name").textContent = data.planName;
  document.querySelector("#plan-target").textContent = data.target;
  document.querySelector("#plan-status").textContent = formatStatus(data.status);
  document.querySelector("#plan-status").dataset.status = data.status;
  document.querySelector("#selected-milestone").textContent = `Milestone: ${selectedMilestone?.name || "All Milestones"}`;
  document.querySelector("#milestone-select").innerHTML = renderMilestoneOptions(milestoneOptions, selectedMilestoneId);

  document.querySelector("#top-summary").innerHTML = [
    renderSummaryCard("Stages", filteredSummary.stages),
    renderSummaryCard("Batches", filteredSummary.batches),
    renderSummaryCard("Tasks", filteredSummary.tasks),
  ].join("");

  document.querySelector("#current-focus").innerHTML = renderCurrentFocus(data.currentFocus);
  document.querySelector("#open-questions").innerHTML = renderStringList(data.openQuestions, "No open questions.");
  document.querySelector("#resolved-decisions").innerHTML = renderStringList(data.resolvedDecisions, "No resolved decisions.");
  document.querySelector("#stages").innerHTML = renderStageProgress(filteredStages, selectedStage, selectedMilestoneId);
  bindStageFlow();
  bindCurrentFocusJump();
  bindDetailButtons();
  bindDetailModal();
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
  const batchDisplay = formatFocusBatch(currentFocus);
  const resolvedTargetId = currentFocus.taskName
    ? `task-${slugify(currentFocus.taskName)}`
    : currentFocus.batchId
      ? `batch-${currentFocus.batchId}`
      : currentFocus.stageId
        ? `stage-${slugify(currentFocus.stageId)}`
        : "";
  const status = currentFocus.taskStatus || "other";
  const jumpButton = resolvedTargetId
    ? `<button class="focus-link-button" data-target-id="${resolvedTargetId}">Jump To Detail</button>`
    : "";

  return `
    <div class="focus-grid">
      <div class="focus-block">
        <p class="task-detail-label">Milestone</p>
        <p class="focus-copy">${escapeHtml(currentFocus.milestoneName || currentFocus.milestoneId || "Not set")}</p>
      </div>
      <div class="focus-block">
        <p class="task-detail-label">Stage</p>
        <p class="focus-copy">${escapeHtml(currentFocus.stageId || "Not set")}</p>
      </div>
      <div class="focus-block">
        <p class="task-detail-label">Batch</p>
        <p class="focus-copy">${escapeHtml(batchDisplay)}</p>
      </div>
      <div class="focus-block focus-block-full">
        <p class="task-detail-label">Task</p>
        <p class="focus-copy focus-copy-strong">${escapeHtml(currentFocus.taskName || currentFocus.taskSummary || "Not set")}</p>
      </div>
    </div>
    <div class="focus-actions">
      <span class="status-chip" data-status="${status}">${formatStatus(status)}</span>
      ${jumpButton}
    </div>
  `;
}

function renderStageProgress(stages, selectedStage, selectedMilestoneId) {
  const emptyText = selectedMilestoneId === "all"
    ? "No stages."
    : "No stages in this milestone.";

  if (!stages.length || !selectedStage) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return `
    <section class="stage-progress-section">
      <div class="group-header">
        <h3>Stage Flow</h3>
      </div>
      <div class="stage-flow">
        ${stages.map((stage, index) => renderStageFlowNode(stage, index, stage.stageId === selectedStage.stageId)).join("")}
      </div>
    </section>
    <section class="stage-progress-section">
      <div class="group-header">
        <h3>Stage Summary</h3>
      </div>
      ${renderStageSummary(selectedStage)}
    </section>
    <section class="stage-progress-section">
      <div class="group-header">
        <h3>Batch List</h3>
      </div>
      <div class="batch-stack">
        ${selectedStage.batches.map(renderBatchCard).join("")}
      </div>
    </section>
  `;
}

function renderStageFlowNode(stage, index, isSelected) {
  return `
    <button
      class="stage-flow-node ${isSelected ? "is-selected" : ""}"
      data-stage-id="${escapeHtml(stage.stageId)}"
      type="button"
      aria-pressed="${isSelected ? "true" : "false"}"
      title="${escapeHtml(stage.stageId)}"
    >
      <span class="stage-flow-index">S${index + 1}</span>
      <span class="stage-flow-name">${escapeHtml(stage.stageId)}</span>
      <span class="status-chip" data-status="${stage.stageStatus}">${formatStatus(stage.stageStatus)}</span>
    </button>
  `;
}

function renderStageSummary(stage) {
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedStage = focus?.stageId === stage.stageId;

  return `
    <section class="stage-card stage-detail-card ${isFocusedStage ? "stage-detail-focused" : ""}" id="stage-${slugify(stage.stageId)}">
      <div class="stage-header">
        <div class="stage-main">
          <p class="stage-meta">${escapeHtml(stage.milestoneName || stage.milestoneId || "Milestone")} · Stage</p>
          <h3>${stage.stageId}</h3>
          <p class="stage-brief">${stage.goal}</p>
        </div>
        <div class="stage-actions">
          <span class="status-chip" data-status="${stage.stageStatus}">${formatStatus(stage.stageStatus)}</span>
          <button
            class="detail-link-button"
            type="button"
            data-detail-type="stage"
            data-detail-id="${escapeHtml(stage.stageId)}"
          >
            Detail
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderBatchCard(batch) {
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedBatch = focus?.batchId === batch.batchId;

  return `
    <details class="batch-card ${isFocusedBatch ? "jump-highlight" : ""}" id="batch-${batch.batchId}" ${isFocusedBatch ? "open" : ""}>
      <summary class="batch-header">
        <div class="batch-main">
          <p class="batch-id">${batch.batchId}</p>
          <h4>${escapeHtml(batch.batchType || "batch")}</h4>
          <p class="batch-brief">${batch.goal}</p>
        </div>
        <div class="batch-actions">
          <span class="status-chip" data-status="${batch.batchStatus}">${formatStatus(batch.batchStatus)}</span>
          <button
            class="detail-link-button"
            type="button"
            data-detail-type="batch"
            data-detail-id="${escapeHtml(batch.batchId)}"
          >
            Detail
          </button>
        </div>
      </summary>
      <div class="task-list">
        ${batch.tasks.map((task) => renderTaskCard(task)).join("")}
      </div>
    </details>
  `;
}

function renderTaskCard(task) {
  const focus = window.__WORK_PLAN_FOCUS__;
  const isFocusedTask = focus?.taskName === task.taskName;

  return `
    <button
      class="task-card task-card-button ${isFocusedTask ? "jump-highlight" : ""}"
      id="task-${slugify(task.taskName)}"
      type="button"
      data-detail-type="task"
      data-detail-id="${escapeHtml(task.taskName)}"
    >
      <div class="task-summary-row">
        <div class="task-main">
          <p class="task-id">${task.taskName}</p>
          <p class="task-title">${task.summary}</p>
        </div>
        <div class="task-actions">
          <span class="status-chip" data-status="${task.status}">${formatStatus(task.status)}</span>
        </div>
      </div>
    </button>
  `;
}

function renderStringList(items, emptyText) {
  if (!items.length) {
    return `<p class="muted">${emptyText}</p>`;
  }

  return items.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("");
}

function renderBatchMeta(batch) {
  return `
    <div class="task-detail-block">
      <p class="task-detail-label">Batch Type</p>
      <p class="task-detail-copy">${escapeHtml(batch.batchType || "unknown")}</p>
    </div>
    <div class="task-detail-block">
      <p class="task-detail-label">Covers</p>
      ${renderInlineCodeList(batch.covers, "No covers listed.")}
    </div>
  `;
}

function renderInlineCodeList(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="task-detail-copy muted">${escapeHtml(emptyText)}</p>`;
  }

  return `<div class="task-file-list">${items.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>`;
}

function formatFocusBatch(currentFocus) {
  const batchId = currentFocus.batchId || "";
  const batchName = currentFocus.batchName || "";

  if (batchId && batchName) {
    return `${batchId} · ${batchName}`;
  }
  return batchId || batchName || "Not set";
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

    const focus = window.__WORK_PLAN_FOCUS__;
    if (focus?.milestoneId) {
      window.__WORK_PLAN_SELECTED_MILESTONE__ = focus.milestoneId;
    }
    if (focus?.stageId) {
      window.__WORK_PLAN_SELECTED_STAGE__ = focus.stageId;
      renderDashboard();
    }

    const rerenderedTarget = document.getElementById(targetId);
    if (!rerenderedTarget) {
      return;
    }

    rerenderedTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    rerenderedTarget.classList.add("jump-highlight");
    window.setTimeout(() => rerenderedTarget.classList.remove("jump-highlight"), 1800);
  });
}

function bindMilestoneFilter() {
  const select = document.querySelector("#milestone-select");
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  select.addEventListener("change", () => {
    window.__WORK_PLAN_SELECTED_MILESTONE__ = select.value;
    window.__WORK_PLAN_SELECTED_STAGE__ = null;
    renderDashboard();
  });
}

function bindStageFlow() {
  const buttons = document.querySelectorAll(".stage-flow-node");
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      window.__WORK_PLAN_SELECTED_STAGE__ = button.dataset.stageId || null;
      renderDashboard();
    });
  }
}

function bindDetailButtons() {
  const buttons = document.querySelectorAll(".detail-link-button, .task-card-button");
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      openDetailModal(button.dataset.detailType || "", button.dataset.detailId || "");
    });
  }
}

function bindDetailModal() {
  const modal = document.querySelector("#detail-modal");
  const closeButton = document.querySelector("#detail-modal-close");
  const backdrop = document.querySelector("#detail-modal-backdrop");

  if (closeButton instanceof HTMLButtonElement) {
    closeButton.onclick = closeDetailModal;
  }
  if (backdrop instanceof HTMLDivElement) {
    backdrop.onclick = closeDetailModal;
  }
  window.onkeydown = (event) => {
    if (event.key === "Escape") {
      closeDetailModal();
    }
  };

  if (modal instanceof HTMLDivElement && modal.hidden === false) {
    closeDetailModal();
  }
}

function openDetailModal(detailType, detailId) {
  const modal = document.querySelector("#detail-modal");
  const title = document.querySelector("#detail-modal-title");
  const kicker = document.querySelector("#detail-modal-kicker");
  const body = document.querySelector("#detail-modal-body");

  if (!(modal instanceof HTMLDivElement) || !(title instanceof HTMLElement) || !(kicker instanceof HTMLElement) || !(body instanceof HTMLDivElement)) {
    return;
  }

  const detail = resolveDetail(detailType, detailId);
  if (!detail) {
    return;
  }

  kicker.textContent = detail.kicker;
  title.textContent = detail.title;
  body.innerHTML = detail.body;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeDetailModal() {
  const modal = document.querySelector("#detail-modal");
  if (!(modal instanceof HTMLDivElement)) {
    return;
  }
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

function resolveDetail(detailType, detailId) {
  const data = window.__WORK_PLAN_DATA__;
  if (!data) {
    return null;
  }

  for (const stage of data.stages) {
    if (detailType === "stage" && stage.stageId === detailId) {
      return {
        kicker: "Stage Detail",
        title: stage.stageId,
        body: renderStageDetailBody(stage),
      };
    }
    for (const batch of stage.batches) {
      if (detailType === "batch" && batch.batchId === detailId) {
        return {
          kicker: "Batch Detail",
          title: `${batch.batchId} · ${batch.batchName || batch.batchId}`,
          body: renderBatchDetailBody(stage, batch),
        };
      }
      for (const task of batch.tasks) {
        if (detailType === "task" && task.taskName === detailId) {
          return {
            kicker: "Task Detail",
            title: task.taskName,
            body: renderTaskDetailBody(stage, batch, task),
          };
        }
      }
    }
  }

  return null;
}

function renderStageDetailBody(stage) {
  return `
    <div class="modal-detail-grid">
      <div class="task-detail-block">
        <p class="task-detail-label">Milestone</p>
        <p class="task-detail-copy">${escapeHtml(stage.milestoneName || stage.milestoneId || "Not set")}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Status</p>
        <p class="task-detail-copy">${formatStatus(stage.stageStatus)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Goal</p>
        <p class="task-detail-copy">${escapeHtml(stage.goal || "Not set")}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Delivered Feature</p>
        <p class="task-detail-copy">${escapeHtml(stage.deliveredFeature || "Not set")}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Feature Scope</p>
        ${renderInlineCodeList(stage.featureScope, "No feature scope listed.")}
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Batch Summary</p>
        ${renderStatusRow(stage.summary.batches)}
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Task Summary</p>
        ${renderStatusRow(stage.summary.tasks)}
      </div>
    </div>
  `;
}

function renderBatchDetailBody(stage, batch) {
  return `
    <div class="modal-detail-grid">
      <div class="task-detail-block">
        <p class="task-detail-label">Stage</p>
        <p class="task-detail-copy">${escapeHtml(stage.stageId)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Status</p>
        <p class="task-detail-copy">${formatStatus(batch.batchStatus)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Goal</p>
        <p class="task-detail-copy">${escapeHtml(batch.goal || "Not set")}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Covers</p>
        ${renderInlineCodeList(batch.covers, "No covers listed.")}
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Tasks</p>
        <div class="task-file-list">${batch.tasks.map((task) => `<code>${escapeHtml(task.taskName)}</code>`).join("")}</div>
      </div>
    </div>
  `;
}

function renderTaskDetailBody(stage, batch, task) {
  const involvedFiles = Array.isArray(task.involvedFiles) ? task.involvedFiles : [];
  return `
    <div class="modal-detail-grid">
      <div class="task-detail-block">
        <p class="task-detail-label">Stage</p>
        <p class="task-detail-copy">${escapeHtml(stage.stageId)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Batch</p>
        <p class="task-detail-copy">${escapeHtml(`${batch.batchId} · ${batch.batchName || batch.batchId}`)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Status</p>
        <p class="task-detail-copy">${formatStatus(task.status)}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Summary</p>
        <p class="task-detail-copy">${escapeHtml(task.summary || "Not set")}</p>
      </div>
      <div class="task-detail-block">
        <p class="task-detail-label">Involved Files</p>
        ${involvedFiles.length
          ? `<div class="task-file-list">${involvedFiles.map((file) => `<code>${escapeHtml(file)}</code>`).join("")}</div>`
          : `<p class="task-detail-copy muted">No involved files listed.</p>`}
      </div>
    </div>
  `;
}

function buildMilestoneOptions(stages) {
  const options = [{ id: "all", name: "All Milestones" }];
  const seen = new Set();

  for (const stage of stages) {
    if (!stage.milestoneId || seen.has(stage.milestoneId)) {
      continue;
    }
    seen.add(stage.milestoneId);
    options.push({
      id: stage.milestoneId,
      name: stage.milestoneName || stage.milestoneId,
    });
  }

  return options;
}

function renderMilestoneOptions(options, selectedMilestoneId) {
  return options.map((option) => `
    <option value="${escapeHtml(option.id)}" ${option.id === selectedMilestoneId ? "selected" : ""}>
      ${escapeHtml(option.name)}
    </option>
  `).join("");
}

function filterStagesByMilestone(stages, selectedMilestoneId) {
  if (!selectedMilestoneId || selectedMilestoneId === "all") {
    return stages;
  }

  return stages.filter((stage) => stage.milestoneId === selectedMilestoneId);
}

function resolveSelectedStage(stages) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return null;
  }

  const requestedStageId = window.__WORK_PLAN_SELECTED_STAGE__;
  const selectedStage = stages.find((stage) => stage.stageId === requestedStageId);
  if (selectedStage) {
    return selectedStage;
  }

  const focusStageId = window.__WORK_PLAN_FOCUS__?.stageId;
  const focusStage = stages.find((stage) => stage.stageId === focusStageId);
  if (focusStage) {
    window.__WORK_PLAN_SELECTED_STAGE__ = focusStage.stageId;
    return focusStage;
  }

  window.__WORK_PLAN_SELECTED_STAGE__ = stages[0].stageId;
  return stages[0];
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}
