"use client";

import React, { useState } from "react";
import { CaseMilestone, CaseStage } from "../../lib/types";
import { TextInput, SelectInput } from "../common/FormControls";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";

interface CaseMilestoneTimelineProps {
  milestones: CaseMilestone[];
  onToggleMilestone: (milestone: CaseMilestone) => void;
  onAddMilestone: (e: React.FormEvent) => void;
  newMsTitle: string;
  setNewMsTitle: (val: string) => void;
  newMsDate: string;
  setNewMsDate: (val: string) => void;
  newMsStage: string;
  setNewMsStage: (val: string) => void;
  isClient?: boolean;
}

export function CaseMilestoneTimeline({
  milestones,
  onToggleMilestone,
  onAddMilestone,
  newMsTitle,
  setNewMsTitle,
  newMsDate,
  setNewMsDate,
  newMsStage,
  setNewMsStage,
  isClient = false,
}: CaseMilestoneTimelineProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const progressPercent = milestones.length ? Math.round((completedCount / milestones.length) * 100) : 0;

  const filteredMilestones = milestones.filter((m) => {
    if (filter === "completed") return m.status === "completed";
    if (filter === "pending") return m.status !== "completed";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 1. VISUAL PROGRESS TRACKER HEADER */}
      <div className="bg-[#0b2422] border border-[#1b3a36] rounded-xl p-5 text-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-teal-400 font-display">
              Filing Lifecycle Roadmap & Milestones
            </div>
            <h4 className="text-base font-bold text-slate-100 mt-0.5">
              {completedCount} of {milestones.length} Roadmap Milestones Finalized
            </h4>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-teal-300 font-semibold">{progressPercent}% Completed</span>
            <div className="w-32 h-2.5 bg-[#051513] rounded-full overflow-hidden border border-[#18423e]">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* CONNECTED HORIZONTAL STEP NODES (Interactive Visual Progression) */}
        <div className="relative pt-4 pb-2 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[560px] relative px-4">
            {/* Background connecting rail */}
            <div className="absolute left-6 right-6 top-7 h-0.5 bg-[#1b3a36] z-0" />

            {milestones.map((m, idx) => {
              const isDone = m.status === "completed";
              const isNext = !isDone && milestones.slice(0, idx).every((item) => item.status === "completed");

              return (
                <div key={m.id} className="relative z-10 flex flex-col items-center group cursor-pointer text-center">
                  {/* Step Node Icon */}
                  <div
                    onClick={() => !isClient && onToggleMilestone(m)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 border-2 ${
                      isDone
                        ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        : isNext
                        ? "bg-teal-900 border-teal-400 text-teal-200 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.6)]"
                        : "bg-[#09221f] border-[#254641] text-slate-400 hover:border-teal-500"
                    }`}
                    title={isDone ? "Completed milestone" : "Pending milestone"}
                  >
                    {isDone ? "✓" : idx + 1}
                  </div>

                  {/* Stage Label */}
                  <div className="mt-2 text-[10px] font-semibold text-teal-300 max-w-[100px] truncate uppercase tracking-wider">
                    {m.stage.replace(/_/g, " ")}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {m.target_date ? m.target_date.split("T")[0] : "Scheduled"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. MILESTONE ITEMS LIST & CONTROLS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 p-1 bg-[#09221f] rounded-lg border border-[#1b3a36]">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === "all" ? "bg-[#0D6866] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({milestones.length})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === "pending" ? "bg-[#0D6866] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pending ({milestones.length - completedCount})
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                filter === "completed" ? "bg-[#0D6866] text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
          <span className="text-[11px] text-teal-300 font-mono hidden sm:block">
            Chronological Filing Roadmap
          </span>
        </div>

        <div className="space-y-2.5">
          {filteredMilestones.map((m) => (
            <div
              key={m.id}
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all duration-150 ${
                m.status === "completed"
                  ? "bg-[#081e1c]/80 border-[#143d37]"
                  : "bg-[#09221f] border-[#1b3a36] hover:border-teal-700"
              }`}
            >
              <div className="flex items-center gap-3">
                {!isClient && (
                  <input
                    type="checkbox"
                    checked={m.status === "completed"}
                    onChange={() => onToggleMilestone(m)}
                    aria-label={`Mark milestone ${m.title} complete`}
                    className="w-4 h-4 rounded border-slate-700 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                )}
                <div>
                  <strong
                    className={`text-xs block ${
                      m.status === "completed" ? "line-through text-slate-400" : "text-slate-100"
                    }`}
                  >
                    {m.title}
                  </strong>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Stage: <span className="capitalize text-teal-300">{m.stage.replace(/_/g, " ")}</span> • Target Date:{" "}
                    <span className="font-mono">{m.target_date ? m.target_date.split("T")[0] : "Scheduled"}</span>
                    {m.completed_at && (
                      <span className="text-emerald-400 ml-2">
                        • Completed on {new Date(m.completed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Badge variant={m.status === "completed" ? "success" : "review"}>
                {m.status.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* 3. ADD NEW MILESTONE FORM */}
      {!isClient && (
        <form
          onSubmit={onAddMilestone}
          className="p-4 bg-[#081f1d] border border-dashed border-[#1b3a36] rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end text-xs"
        >
          <div className="sm:col-span-2 md:col-span-1">
            <TextInput
              label="Milestone Title"
              value={newMsTitle}
              onChange={(e) => setNewMsTitle(e.target.value)}
              placeholder="e.g. Sworn translation dossier finalized"
              required
            />
          </div>
          <div>
            <TextInput
              label="Target Date"
              type="date"
              value={newMsDate}
              onChange={(e) => setNewMsDate(e.target.value)}
              required
            />
          </div>
          <div>
            <SelectInput
              label="Workflow Stage"
              value={newMsStage}
              onChange={(e) => setNewMsStage(e.target.value)}
              options={[
                { label: "Intake", value: "intake" },
                { label: "Processing", value: "processing" },
                { label: "Internal Review", value: "internal_review" },
                { label: "Submission", value: "submitted" },
              ]}
            />
          </div>
          <div>
            <Button variant="primary" type="submit" size="sm" className="w-full">
              + Add Milestone
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
