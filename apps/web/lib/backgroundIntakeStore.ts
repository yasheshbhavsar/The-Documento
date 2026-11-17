/**
 * Non-Blocking Background Document & Packet Intake Store
 * Event emitter + state store powering BackgroundProcessingTray so applicants,
 * sponsors, and caseworkers never wait on large 60-page multi-person PDF packets.
 */

export interface BackgroundIntakeJob {
  id: string;
  caseId?: string;
  filename: string;
  status: "processing" | "completed" | "error";
  currentPage: number;
  totalPages: number;
  filesProcessed: number;
  totalFiles: number;
  progressText: string;
  completionSummary?: string;
  documentsProduced?: number;
  pendingPrefillCount?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export const BACKGROUND_INTAKE_EVENT = "documento:background-intake-updated";

type Listener = (jobs: BackgroundIntakeJob[]) => void;

let activeJobs: BackgroundIntakeJob[] = [];
const listeners = new Set<Listener>();

function emitChange(): void {
  const snapshot = [...activeJobs];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // Ignore listener error
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(BACKGROUND_INTAKE_EVENT, {
        detail: { jobs: snapshot },
      })
    );
  }
}

export function getBackgroundIntakeJobs(): BackgroundIntakeJob[] {
  return [...activeJobs];
}

export function subscribeBackgroundIntakeJobs(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function enqueueBackgroundIntakeJob(params: {
  id?: string;
  caseId?: string;
  filename: string;
  currentPage?: number;
  totalPages?: number;
  filesProcessed?: number;
  totalFiles?: number;
  progressText?: string;
}): BackgroundIntakeJob {
  const now = new Date().toISOString();
  const id = params.id || `bg-intake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const currentPage = params.currentPage ?? 1;
  const totalPages = Math.max(currentPage, params.totalPages ?? 1);
  const job: BackgroundIntakeJob = {
    id,
    caseId: params.caseId,
    filename: params.filename,
    status: "processing",
    currentPage,
    totalPages,
    filesProcessed: params.filesProcessed ?? 0,
    totalFiles: params.totalFiles ?? 1,
    progressText:
      params.progressText ||
      `Sorting & extracting ${params.filename} — Page ${currentPage} of ${totalPages}...`,
    createdAt: now,
    updatedAt: now,
  };

  activeJobs = [job, ...activeJobs.filter((j) => j.id !== id)];
  emitChange();
  return job;
}

export function updateBackgroundIntakeJob(
  id: string,
  patch: Partial<Omit<BackgroundIntakeJob, "id" | "createdAt">>
): BackgroundIntakeJob | null {
  let updatedJob: BackgroundIntakeJob | null = null;
  activeJobs = activeJobs.map((job) => {
    if (job.id !== id) return job;
    const nextCurrent = patch.currentPage ?? job.currentPage;
    const nextTotal = Math.max(nextCurrent, patch.totalPages ?? job.totalPages);
    updatedJob = {
      ...job,
      ...patch,
      currentPage: nextCurrent,
      totalPages: nextTotal,
      progressText:
        patch.progressText ||
        (patch.status === "completed" && patch.completionSummary
          ? patch.completionSummary
          : `Sorting & extracting ${job.filename} — Page ${nextCurrent} of ${nextTotal}...`),
      updatedAt: new Date().toISOString(),
    };
    return updatedJob;
  });
  if (updatedJob) {
    emitChange();
  }
  return updatedJob;
}

export function completeBackgroundIntakeJob(
  id: string,
  result: {
    completionSummary: string;
    documentsProduced?: number;
    pendingPrefillCount?: number;
    totalPages?: number;
  }
): BackgroundIntakeJob | null {
  return updateBackgroundIntakeJob(id, {
    status: "completed",
    currentPage: result.totalPages ?? activeJobs.find((j) => j.id === id)?.totalPages ?? 1,
    totalPages: result.totalPages ?? activeJobs.find((j) => j.id === id)?.totalPages ?? 1,
    completionSummary: result.completionSummary,
    progressText: result.completionSummary,
    documentsProduced: result.documentsProduced,
    pendingPrefillCount: result.pendingPrefillCount,
  });
}

export function failBackgroundIntakeJob(id: string, errorMessage: string): BackgroundIntakeJob | null {
  return updateBackgroundIntakeJob(id, {
    status: "error",
    errorMessage,
    progressText: `Failed processing: ${errorMessage}`,
  });
}

export function dismissBackgroundIntakeJob(id: string): void {
  const prevLen = activeJobs.length;
  activeJobs = activeJobs.filter((j) => j.id !== id);
  if (activeJobs.length !== prevLen) {
    emitChange();
  }
}

export function clearBackgroundIntakeJobs(): void {
  if (activeJobs.length === 0) return;
  activeJobs = [];
  emitChange();
}
