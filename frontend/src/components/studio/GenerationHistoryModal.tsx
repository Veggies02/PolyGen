import React, { useState, useEffect } from 'react';
import type { JobStatus, Asset } from '../../types';
import { api } from '../../api/client';
import { 
  X, 
  History, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Box, 
  RotateCcw, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface GenerationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInspectAsset: (asset: Asset) => void;
  onReusePrompt: (prompt: string) => void;
  assets: Asset[];
}

export const GenerationHistoryModal: React.FC<GenerationHistoryModalProps> = ({
  isOpen,
  onClose,
  onInspectAsset,
  onReusePrompt,
  assets,
}) => {
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listJobs();
      setJobs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch generation history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Generation Job History
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                  {jobs.length} Jobs
                </span>
              </h2>
              <p className="text-xs text-slate-400">Track recent 3D synthesis tasks, inspect results, and reuse prompts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchJobs}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh History"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1">
          {loading && jobs.length === 0 && (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="text-xs">Loading generation activity...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && jobs.length === 0 && !error && (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Box className="w-10 h-10 text-slate-600 mb-1" />
              <h3 className="text-sm font-semibold text-slate-300">No generation jobs yet</h3>
              <p className="text-xs text-slate-500 max-w-xs">
                Launch your first Text-to-3D generation in the studio to see live stage tracking and historical metrics here.
              </p>
            </div>
          )}

          {jobs.map((job) => {
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed';
            const isActive = !isCompleted && !isFailed;
            const matchedAsset = job.asset_id ? assets.find((a) => a.id === job.asset_id) : null;

            return (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-slate-500 font-bold uppercase">
                        #{job.id}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${
                          isCompleted
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                            : isFailed
                            ? 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                        {isFailed && <AlertCircle className="w-3 h-3" />}
                        {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span className="capitalize">{job.status}</span>
                      </span>

                      <span className="text-[10px] text-slate-500 font-mono">
                        Engine: {job.provider}
                      </span>
                    </div>

                    <p className="text-slate-200 font-medium line-clamp-2 leading-relaxed">
                      "{job.prompt}"
                    </p>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Progress bar if active */}
                {isActive && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{job.current_stage}</span>
                      <span className="font-mono text-blue-400">{job.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[11px] text-slate-500 italic">
                    {job.current_stage}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onReusePrompt(job.prompt);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white flex items-center gap-1 text-[11px] transition-colors"
                      title="Copy prompt into 3D Studio"
                    >
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>Reuse Prompt</span>
                    </button>

                    {matchedAsset && (
                      <button
                        onClick={() => {
                          onInspectAsset(matchedAsset);
                          onClose();
                        }}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1 text-[11px] shadow-sm transition-all"
                      >
                        <Box className="w-3 h-3" />
                        <span>Inspect in 3D</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Jobs are saved for current session execution</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
