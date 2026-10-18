import React, { useState, useEffect } from "react";
import { ChaosScenario, ContingencyOption } from "@/api/contracts/types";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { useAppStore } from "@/store/useAppStore";
import {
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface ChaosPlaybackProps {
  scenarios: ChaosScenario[];
  selectedScenarioId: string;
  onSelectScenario: (id: string) => void;
  /** Envelope source of the scenario catalogue, e.g. stored_record. */
  source?: string;
  /** Whether the backend can recompute these narrative effects. */
  effectsAvailable?: boolean;
  effectsReason?: string;
}

export const ChaosPlayback: React.FC<ChaosPlaybackProps> = ({
  scenarios,
  selectedScenarioId,
  onSelectScenario,
  source = "Source unknown",
  effectsAvailable = false,
  effectsReason = "The backend has not declared support for narrative effects.",
}) => {
  const { setCurrentPage, addToast } = useAppStore();
  const currentScenario =
    scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0];

  // 4-Phase Cinematic Playback State
  // Phase 1: Trigger event and shockwave at the affected node.
  // Phase 2: Propagate the effect along connected paths.
  // Phase 3: Show the cash impact and any resulting deficit.
  // Phase 4: Present explicit contingency options.
  const [currentPhase, setCurrentPhase] = useState<1 | 2 | 3 | 4>(1);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let timer: number | null = null;
    if (isPlaying) {
      timer = window.setTimeout(() => {
        if (currentPhase < 4) {
          setCurrentPhase((p) => (p + 1) as 1 | 2 | 3 | 4);
        } else {
          setIsPlaying(false);
        }
      }, 1600);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPlaying, currentPhase]);

  const handleStartPlayback = () => {
    setCurrentPhase(1);
    setIsPlaying(true);
  };

  const handleApplyContingency = (option: ContingencyOption) => {
    addToast({
      type: "info",
      title: "Open a page to continue",
      message: `${option.title} · No contingency plan was activated, reserved, or saved (${effectsReason})`,
      duration: 9000,
    });
    setCurrentPage(option.targetPage as any);
  };

  return (
    <div className="bg-navy-deep text-white rounded-card p-6 border border-navy-border shadow-soft-lg space-y-6 select-none overflow-hidden relative">
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-danger/10 blur-3xl pointer-events-none" />

      {/* Header & Scenario Selection Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-navy-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-danger/20 text-danger border border-danger/40">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h3 className="font-display font-bold text-white text-base">
              Chaos Rehearsal Playback
            </h3>
            <DataKindBadge kind="simulated" size="sm" />
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            {effectsAvailable
              ? "Test a four-phase risk scenario: disruption → propagation → cash impact → contingency"
              : `Review a saved scenario (${source}). Figures come from a catalogue and are not recalculated by the engine · Change price, costs, deposits, or payment terms below to run a new calculation.`}
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartPlayback}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs font-bold flex items-center gap-1.5 shadow-glow-primary transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>{isPlaying ? "Simulating..." : "Play scenario"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setCurrentPhase(1);
            }}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-navy-surface transition-colors"
            title="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scenario Chooser */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((sc) => (
          <button
            key={sc.id}
            type="button"
            onClick={() => {
              onSelectScenario(sc.id);
              setCurrentPhase(1);
              setIsPlaying(false);
            }}
            className={`px-3 py-1.5 rounded-chip text-xs font-medium border transition-all ${
              selectedScenarioId === sc.id
                ? "bg-danger text-white border-danger shadow-glow-danger font-bold"
                : "bg-navy-surface border-navy-border text-slate-300 hover:text-white"
            }`}
          >
            {sc.title}
          </button>
        ))}
      </div>

      {/* 4-Phase Step Progress Indicator (Part E4 S6) */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {[
          { num: 1, label: "1. Disruption", desc: "Shockwave trigger point" },
          { num: 2, label: "2. Affected areas", desc: "Propagation across connections" },
          { num: 3, label: "3. Cash impact", desc: "Projected cash decline" },
          { num: 4, label: "4. Contingency", desc: "Saved proposals" },
        ].map((ph) => (
          <button
            key={ph.num}
            type="button"
            onClick={() => setCurrentPhase(ph.num as 1 | 2 | 3 | 4)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              currentPhase === ph.num
                ? "bg-navy-surface border-brand-glow ring-2 ring-brand-glow/40 shadow-sm"
                : currentPhase > ph.num
                ? "bg-navy-surface/50 border-emerald-500/50 text-slate-400"
                : "bg-navy-surface/20 border-navy-border text-slate-500"
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold text-white text-[11px]">{ph.label}</span>
              <span className={`w-2 h-2 rounded-full ${currentPhase === ph.num ? "bg-brand-glow animate-ping" : "bg-slate-600"}`} />
            </div>
            <div className="text-[10px] text-slate-400">{ph.desc}</div>
          </button>
        ))}
      </div>

      {/* Cinematic Stage Area */}
      <div className="min-h-[220px] bg-navy-surface rounded-2xl border border-navy-border p-5 flex flex-col justify-between">
        {/* Phase 1: Shockwave at Trigger Node */}
        {currentPhase === 1 && (
          <div className="space-y-4 animate-fade-in text-center my-auto">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-danger/30 animate-ping absolute inset-0" />
              <div className="w-12 h-12 rounded-full bg-danger text-white flex items-center justify-center font-bold text-lg relative z-10 shadow-glow-danger">
                !
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-danger uppercase tracking-widest block mb-1">
                Phase 1: Disruption
              </span>
              <h4 className="text-base font-display font-bold text-white">
                {currentScenario.title}
              </h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto mt-1 leading-relaxed">
                {currentScenario.description}
              </p>
            </div>
          </div>
        )}

        {/* Phase 2: Propagation along link paths */}
        {currentPhase === 2 && (
          <div className="space-y-4 animate-fade-in my-auto">
            <span className="text-[10px] font-bold text-attention uppercase tracking-widest block text-center">
              Phase 2: Impact propagates through the network
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg mx-auto">
              {currentScenario.propagationPath.map((node, idx) => (
                <React.Fragment key={node}>
                  <div className="px-3 py-2 rounded-xl bg-red-950/60 border border-danger text-xs font-mono text-white flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                    <span>{node}</span>
                  </div>
                  {idx < currentScenario.propagationPath.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-danger animate-pulse" />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-slate-300 text-center max-w-md mx-auto">
              Impact path recorded in this scenario · The engine has not recalculated actual allocation effects.
            </p>
          </div>
        )}

        {/* Phase 3: Cash Dive & Deficit Rollup */}
        {currentPhase === 3 && (
          <div className="space-y-4 animate-fade-in my-auto text-center">
            <span className="text-[10px] font-bold text-danger uppercase tracking-widest block">
              Phase 3: Cash drops sharply
            </span>
            <div className="flex justify-center items-center gap-6">
              <div className="p-3 bg-red-950/40 rounded-xl border border-danger/40">
                <span className="text-[10px] text-slate-400 block">
                  {effectsAvailable ? "Additional working-capital gap" : "Value recorded in scenario (not recalculated)"}
                </span>
                <span className="text-2xl font-extrabold font-mono text-danger tabular-nums">
                  +฿{currentScenario.cashImpactAmount.toLocaleString("en-US")}
                </span>
              </div>
              <div className="p-3 bg-red-950/40 rounded-xl border border-danger/40">
                <span className="text-[10px] text-slate-400 block">
                  {currentScenario.deficitDays.length ? "Recorded days with negative cash" : "Days with negative cash"}
                </span>
                <span className="text-xl font-bold font-mono text-white">
                  {currentScenario.deficitDays.length ? `Day ${currentScenario.deficitDays.join(", ")}` : "Not recorded"}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              {currentScenario.description} · No contract or evidence supports penalties, delays, or effects on other shops.
              The system does not estimate them.
            </p>
          </div>
        )}

        {/* Phase 4: Contingency Options */}
        {currentPhase === 4 && (
          <div className="space-y-3 animate-fade-in">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
              Phase 4: Saved contingency options (proposals for review, not active arrangements)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentScenario.contingencyOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="p-3.5 bg-navy-card rounded-xl border border-navy-border hover:border-brand-glow transition-all flex flex-col justify-between space-y-2"
                >
                  <div>
                    <h5 className="font-display font-bold text-xs text-white mb-1">
                      {opt.title}
                    </h5>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {opt.savingsOrMitigation}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyContingency(opt)}
                    className="w-full py-1.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-sm"
                  >
                    <span>{opt.actionText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Phase Controller */}
        <div className="flex items-center justify-between border-t border-navy-border pt-3 mt-4 text-[11px] text-slate-400">
          <span>Severity: <strong>{currentScenario.severity.toUpperCase()}</strong></span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPhase(Math.max(1, currentPhase - 1) as 1 | 2 | 3 | 4)}
              disabled={currentPhase === 1}
              className="hover:text-white disabled:opacity-30"
            >
              Back
            </button>
            <span className="font-mono text-white">{currentPhase} / 4</span>
            <button
              type="button"
              onClick={() => setCurrentPhase(Math.min(4, currentPhase + 1) as 1 | 2 | 3 | 4)}
              disabled={currentPhase === 4}
              className="hover:text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
