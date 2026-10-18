import React, { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Sparkles,
  AlertTriangle,
  Coins,
  CheckCircle2,
  Users,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export const StoryModeModal: React.FC = () => {
  const {
    isStoryModeOpen,
    storyCurrentScene,
    setStoryModeOpen,
    setStoryScene,
    nextStoryScene,
    prevStoryScene,
  } = useAppStore();

  // Keyboard navigation: ArrowLeft, ArrowRight, Space, Escape
  useEffect(() => {
    if (!isStoryModeOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        nextStoryScene();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStoryScene();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setStoryModeOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStoryModeOpen, nextStoryScene, prevStoryScene, setStoryModeOpen]);

  if (!isStoryModeOpen) return null;

  const scenes = [
    {
      act: "Scene 1",
      title: "A Large Business Opportunity: 300 Meal Boxes per Day",
      subtitle: "An example request from Siam Technopark Co. · 10 business days · 3,000 boxes · Budget ฿255,000",
      highlightMetric: "300 boxes/day × 10 days",
      metricLabel: "Total project value ฿255,000",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-navy-border space-y-4 max-w-xl mx-auto text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-glow font-semibold tracking-wider uppercase">
              A Common Challenge for SMEs
            </span>
            <DataKindBadge kind="actual" size="sm" />
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            A small restaurant may not be able to fulfill a large order of 300 boxes per day on its own because production capacity and kitchen space are limited (typically 50–70 boxes per day). Declining the order could mean missing a major revenue opportunity.
          </p>
          <div className="p-3 bg-navy-card rounded-xl border border-navy-border flex items-center justify-between text-xs">
            <span className="text-slate-300">Requirements:</span>
            <span className="text-white font-medium">Eco-friendly, biodegradable boxes · Delivered before 11:15 AM</span>
          </div>
        </div>
      ),
    },
    {
      act: "Scene 2",
      title: "SME SWARM Team Assembly: Six Shops Join the Order",
      subtitle: "The system finds nearby shops with available capacity and assigns 50 boxes per day to each.",
      highlightMetric: "6 shops × 50 boxes",
      metricLabel: "Total capacity: 300 boxes/day (100%)",
      content: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          {[
            { name: "Baan Khao Hom", role: "Roasted chicken with jasmine rice", gap: "Shortfall ฿14,000" },
            { name: "Pa Samorn Kitchen", role: "Traditional basil pork", gap: "Cash ready" },
            { name: "Jae Dao Southern Curry", role: "Southern-style curry", gap: "Shortfall ฿15,500" },
            { name: "Hia Hong Crispy Pork", role: "Charcoal-roasted crispy pork", gap: "Cash ready" },
            { name: "Garden Greens Kitchen", role: "Organic chicken breast", gap: "Cash ready" },
            { name: "Mae Phen Bento", role: "Grandma's five-spice eggs", gap: "Cash ready" },
          ].map((s, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-navy-surface border border-navy-border text-xs">
              <div className="font-semibold text-white truncate">{s.name}</div>
              <div className="text-[11px] text-slate-400">{s.role} (50 boxes)</div>
              <div className={`text-[10px] mt-2 font-mono font-bold ${s.gap.includes("Shortfall") ? "text-danger" : "text-emerald-400"}`}>
                {s.gap}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      act: "Scene 3",
      title: "The Project Bottleneck: Two Shops Need Working Capital Up Front",
      subtitle: "A shop-level cash flow review indicates that two shops cannot begin production without an initial cash injection.",
      highlightMetric: "฿29,500",
      metricLabel: "Total working-capital shortfall (Baan Khao Hom + Jae Dao)",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-danger/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-danger">
          <div className="flex items-center gap-2 text-danger font-bold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Project bottleneck</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            Although each shop is projected to earn ฿11,000–12,500 in net profit, Baan Khao Hom needs to pay ฿18,000 for rice and fresh chicken on day one but has only ฿10,000 in cash (a ฿14,000 gap). Jae Dao has a ฿15,500 gap.
          </p>
          <div className="p-3 bg-red-950/40 rounded-xl border border-danger/30 text-xs text-red-200 flex items-center justify-between">
            <span>System status:</span>
            <span className="font-bold text-danger">Do not start until the funding gap is covered</span>
          </div>
        </div>
      ),
    },
    {
      act: "Scene 4",
      title: "Unlock Funding: Connect to Invoice Factoring in 24 Hours",
      subtitle: "Use a confirmed purchase order (PO) to request 85% of the cash up front without collateral.",
      highlightMetric: "24 hours",
      metricLabel: "฿29,500 cash approved · 8.5% annual interest",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-resource/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-resource">
          <div className="flex items-center gap-2 text-resource font-bold text-sm">
            <Coins className="w-4 h-4 shrink-0" />
            <span>Funding match: Project-specific factoring</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            The funder provides ฿14,000 in working capital to Baan Khao Hom and ฿15,500 to Jae Dao, allowing all six shops to cover ingredient costs from day one. The project is ready to proceed at full capacity.
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-navy-card border border-navy-border">
              <span className="text-slate-400 block text-[10px]">Total interest for project</span>
              <span className="text-white font-bold font-mono">฿209.50 (calculated by actual days)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-navy-card border border-navy-border">
              <span className="text-slate-400 block text-[10px]">Cash disbursement date</span>
              <span className="text-resource font-bold">Nov 1 (before ingredient purchasing)</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      act: "Scene 5",
      title: "Crisis Rehearsal: Simulate a Shop's Sudden Withdrawal",
      subtitle: "Chaos Rehearsal scenario: Jae Dao withdraws unexpectedly on day two.",
      highlightMetric: "4 event phases",
      metricLabel: "Disruption → Propagation → Cash impact → Contingency",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-attention/40 max-w-xl mx-auto text-left space-y-4">
          <div className="flex items-center gap-2 text-attention font-bold text-sm">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Contingency option</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            The red wave follows the links to show the impact: without action, the project would be short 50 boxes per day and incur a ฿10,000 late fee. The system can bring in Rom Sai Kitchen, the top-ranked backup, with one click.
          </p>
          <div className="p-3 bg-navy-card rounded-xl border border-navy-border flex items-center justify-between text-xs">
            <span className="text-slate-300">Rehearsal result:</span>
            <span className="text-emerald-400 font-bold">100% of the projected impact avoided</span>
          </div>
        </div>
      ),
    },
    {
      act: "Scene 6",
      title: "Outcome: Every Shop Retains a Profit",
      subtitle: "All 3,000 boxes delivered, full payment received, and the project completed to ESG standards.",
      highlightMetric: "฿69,000",
      metricLabel: "Total net profit across 6 communities (average ฿11,500 per shop)",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-brand/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-primary">
          <div className="flex items-center gap-2 text-brand-glow font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Presentation targets (not measured by the system)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">On-time delivery rate (target)</span>
              <span className="text-sm font-bold text-emerald-400">Not measured</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">Logistics cost reduction (target)</span>
              <span className="text-sm font-bold text-resource">Not measured</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">Non-performing loans (NPL) (target)</span>
              <span className="text-sm font-bold text-emerald-400">Not measured</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 text-center leading-relaxed">
            "SME Finance Copilot turns static reports into a practical studio for building business opportunities."
          </p>
        </div>
      ),
    },
  ];

  const current = scenes[storyCurrentScene - 1];

  return (
    <div className="fixed inset-0 z-50 bg-navy-deep text-white flex flex-col justify-between p-6 overflow-hidden animate-fade-in">
      {/* Top Stepper Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-navy-border pb-4">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-chip bg-brand/20 border border-brand text-brand-glow text-xs font-bold font-mono">
            STORY MODE
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Prewritten presentation · Scene figures are illustrative examples, not system-generated calculations.
          </span>
        </div>

        {/* Scene Progress Dots */}
        <div className="flex items-center gap-2">
          {scenes.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStoryScene(idx + 1)}
              className={`h-2 rounded-full transition-all duration-300 ${
                storyCurrentScene === idx + 1
                  ? "w-8 bg-brand-glow shadow-glow-primary"
                  : idx + 1 < storyCurrentScene
                  ? "w-2 bg-emerald-400"
                  : "w-2 bg-navy-border"
              }`}
              title={`Scene ${idx + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStoryModeOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-surface rounded-lg transition-colors flex items-center gap-1 text-xs"
        >
          <span>Exit Story Mode (Esc)</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Cinematic Stage */}
      <div className="max-w-4xl w-full mx-auto my-auto text-center space-y-6">
        <div>
          <span className="text-xs font-bold text-brand-glow tracking-widest uppercase block mb-1">
            {current.act}
          </span>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2 leading-tight">
            {current.title}
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            {current.subtitle}
          </p>
        </div>

        {/* Big Key Metric Pill */}
        <div className="inline-flex flex-col items-center p-3 px-6 rounded-2xl bg-navy-surface/80 border border-navy-border shadow-soft-lg">
          <span className="text-2xl md:text-4xl font-display font-extrabold text-brand-glow tracking-tight">
            {current.highlightMetric}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-1">
            {current.metricLabel}
          </span>
        </div>

        {/* Scene Interactive Content */}
        <div>{current.content}</div>
      </div>

      {/* Bottom Controller Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between border-t border-navy-border pt-4 text-xs">
        <button
          type="button"
          onClick={() => setStoryScene(1)}
          className="text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restart from Scene 1</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevStoryScene}
            disabled={storyCurrentScene === 1}
            className="px-4 py-2 rounded-btn bg-navy-surface border border-navy-border text-slate-200 hover:bg-navy-card disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back (←)</span>
          </button>

          <span className="font-mono text-slate-400">
            {storyCurrentScene} / {scenes.length}
          </span>

          <button
            type="button"
            onClick={() => {
              if (storyCurrentScene === scenes.length) {
                setStoryModeOpen(false);
              } else {
                nextStoryScene();
              }
            }}
            className="px-5 py-2 rounded-btn bg-brand hover:bg-brand-dark text-white font-semibold flex items-center gap-1 shadow-glow-primary transition-all"
          >
            <span>{storyCurrentScene === scenes.length ? "Finish (exit)" : "Next (→ / Space)"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Press Spacebar or the right arrow to continue
        </div>
      </div>
    </div>
  );
};
