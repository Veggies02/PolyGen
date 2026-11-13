import React from 'react';
import type { JobStatus } from '../../types';
import { Loader2, CheckCircle2, AlertTriangle, Sparkles, Box, ArrowRight } from 'lucide-react';

interface JobProgressModalProps {
  job: JobStatus | null;
  onInspect: (assetId: string) => void;
  onClose: () => void;
}

export const JobProgressModal: React.FC<JobProgressModalProps> = ({ job, onInspect, onClose }) => {
  if (!job) return null;

  const stages = [
    { name: 'Prompt & Semantics', minProgress: 10 },
    { name: 'Geometry Synthesis', minProgress: 40 },
    { name: 'Topology & Normals', minProgress: 70 },
    { name: 'PBR Shading & glTF Compilation', minProgress: 100 },
  ];

  const isFailed = job.status === 'failed';
  const isCompleted = job.status === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">PolyGen Synthesis Engine</h3>
              <p className="text-xs text-slate-400 font-mono">Job ID: {job.id}</p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
              isCompleted
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                : isFailed
                ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                : 'bg-cyan-950 text-cyan-400 border border-cyan-500/40 animate-pulse'
            }`}
          >
            {job.status}
          </span>
        </div>

        {/* Prompt Overview */}
        <div className="my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
          <span className="text-slate-500 font-medium block mb-1">Target Prompt</span>
          <p className="text-slate-200 italic font-serif">"{job.prompt}"</p>
        </div>

        {/* Progress Bar & Status Text */}
        <div className="my-4">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-300">{job.current_stage}</span>
            <span className="text-cyan-400 font-mono">{job.progress}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                isFailed
                  ? 'bg-rose-500'
                  : isCompleted
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
              }`}
              style={{ width: `${Math.max(job.progress, 5)}%` }}
            />
          </div>
        </div>

        {/* Stage List */}
        <div className="grid grid-cols-1 gap-2 my-4">
          {stages.map((st, idx) => {
            const isDone = job.progress >= st.minProgress || isCompleted;
            const isCurrent = !isDone && (idx === 0 || job.progress >= stages[idx - 1].minProgress);

            return (
              <div
                key={st.name}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : isCurrent
                    ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                    : 'bg-slate-950/30 border-slate-800/50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-[10px] text-slate-600">
                      {idx + 1}
                    </div>
                  )}
                  <span className="font-medium">{st.name}</span>
                </div>
                <span className="text-[10px] font-mono">{isDone ? 'COMPLETE' : isCurrent ? 'IN PROGRESS' : 'QUEUED'}</span>
              </div>
            );
          })}
        </div>

        {/* Error Output */}
        {isFailed && (
          <div className="p-3 my-2 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Generation Error</p>
              <p className="text-rose-300/90 text-[11px] mt-0.5">{job.error || 'Unknown engine error occurred.'}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          {!isCompleted && !isFailed && (
            <span className="text-xs text-slate-500 mr-auto flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
              <span>Synthesizing 3D spatial field...</span>
            </span>
          )}

          {isCompleted && job.asset_id && (
            <button
              onClick={() => onInspect(job.asset_id!)}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wide shadow-md shadow-cyan-500/30 flex items-center gap-1.5 transition-all"
            >
              <Box className="w-4 h-4" />
              <span>Inspect in 3D Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {(isCompleted || isFailed) && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
