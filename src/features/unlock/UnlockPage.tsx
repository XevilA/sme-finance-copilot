import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { UnlockResource, Envelope } from "@/api/contracts/types";
import { ResourceTile } from "@/components/signature/ResourceTile";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  Wrench,
  Sparkles,
  RotateCcw,
  Coins,
  Truck,
  ChefHat,
  Cog,
  Users,
  Building2,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Sliders,
  CheckCircle2,
} from "lucide-react";

export const UnlockPage: React.FC = () => {
  const {
    detachedResourceIds,
    toggleDetachResource,
    resetSimulation,
    addToast,
    setCurrentPage,
  } = useAppStore();

  const [resourcesEnvelope, setResourcesEnvelope] = useState<Envelope<UnlockResource[]> | null>(null);
  const [loading, setLoading] = useState(true);

  // Before/After Value Split Slider (0 to 100%)
  const [splitRatio, setSplitRatio] = useState(50);

  // Active Category Filter
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const loadData = () => {
    setLoading(true);
    apiClient
      .getUnlockResources()
      .then((res) => {
        setResourcesEnvelope(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleDetach = (res: UnlockResource) => {
    toggleDetachResource(res.id);
    const isNowDetached = !detachedResourceIds.includes(res.id);
    if (isNowDetached) {
      addToast({
        type: "warning",
        title: "ถอดชิ้นส่วนทรัพยากรแล้ว",
        message: res.impactIfDetached.bottleneckMessage,
      });
    } else {
      addToast({
        type: "success",
        title: "คืนชิ้นส่วนเข้าโครงการแล้ว",
        message: `นำ '${res.title}' กลับเข้าสู่สายการผลิตเรียบร้อย`,
      });
    }
  };

  if (loading || !resourcesEnvelope) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="h-40 bg-slate-200 rounded-card animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
          <div className="h-64 bg-slate-200 rounded-card animate-pulse" />
        </div>
      </div>
    );
  }

  const allResources = resourcesEnvelope.data;
  const filteredResources =
    activeCategory === "all"
      ? allResources
      : allResources.filter((r) => r.category === activeCategory);

  // Calculate dynamic impact when resources are detached (S5)
  const totalDetachedImpactCost = detachedResourceIds.reduce((sum, id) => {
    const r = allResources.find((res) => res.id === id);
    return sum + (r?.impactIfDetached.additionalCost || 0);
  }, 0);

  return (
    <StateRenderer onRetry={loadData}>
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-resource text-white flex items-center justify-center font-bold">
                <Wrench className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-display font-bold text-ink">
                SME UNLOCK ปลดล็อกและแชร์ทรัพยากร
              </h1>
              <DataKindBadge kind="actual" size="md" />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              จับคู่ครัวกลาง รถขนส่ง เครื่องจักร และแรงงาน เพื่อเปลี่ยนรายจ่ายลงทุนเป็นค่าบริการตามจริง
            </p>
          </div>

          <div className="flex items-center gap-2">
            {detachedResourceIds.length > 0 && (
              <button
                type="button"
                onClick={resetSimulation}
                className="px-3 py-1.5 bg-white border border-borderLine hover:border-brand/40 text-xs font-semibold rounded-btn flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-ink-muted" />
                <span>คืนชิ้นส่วนทั้งหมด ({detachedResourceIds.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setCurrentPage("swarm")}
              className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-btn flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>กลับสู่ห้องประกอบทีม SWARM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Signature S5: Detached Part Alert Banner */}
        {detachedResourceIds.length > 0 && (
          <div className="p-4 rounded-card bg-red-50 border-2 border-danger text-danger flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-soft-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-danger text-white flex items-center justify-center shrink-0">
                !
              </div>
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  จำลองการถอดชิ้นส่วน ({detachedResourceIds.length} รายการถูกถอด)
                </h3>
                <p className="text-xs text-red-900 mt-0.5">
                  ส่งผลให้ต้นทุนทั้งโครงการเพิ่มขึ้น <strong>+฿{totalDetachedImpactCost.toLocaleString()}</strong>{" "}
                  และเกิดความเสี่ยงส่งอาหารล่าช้า
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetSimulation}
              className="px-4 py-1.5 bg-danger text-white text-xs font-bold rounded-btn hover:bg-danger-dark transition-all shrink-0"
            >
              คืนชิ้นส่วนสู่โครงการ
            </button>
          </div>
        )}

        {/* Value Unlocked Split Comparison Slider (ซื้อเอง vs ใช้ร่วม) */}
        <div className="bg-white rounded-card p-5 border border-borderLine shadow-soft-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-resource-dark" />
                <span>มูลค่าที่ปลดล็อกได้ (Value Unlocked Comparison)</span>
              </h3>
              <p className="text-[11px] text-ink-muted">
                เปรียบเทียบการลงทุนซื้ออุปกรณ์เองคนเดียว vs การแชร์ร่วมกันในเครือข่าย SWARM
              </p>
            </div>
            <DataKindBadge kind="simulated" size="sm" />
          </div>

          {/* Side-by-Side Split View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column A: Buy Individually */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                แนวทางเดิม: ต่างคนต่างซื้อเอง
              </span>
              <div className="text-2xl font-extrabold font-mono text-ink">฿115,000</div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                ร้านค้าต้องซื้อตู้เย็นอุตสาหกรรม, เตาแก๊สเพิ่ม, จ้างรถมอเตอร์ไซค์แยกเที่ยว, และจ้างคนแพ็กเกจประจำ
              </p>
              <div className="text-[10px] text-danger font-medium mt-2">
                ✕ ใช้เงินทุนเริ่มต้นสูง เสี่ยงสภาพคล่องขาดแคลน
              </div>
            </div>

            {/* Column B: Shared Opportunity via SME UNLOCK */}
            <div className="p-4 rounded-xl bg-resource-light/60 border border-resource/40 space-y-2">
              <span className="text-[10px] font-bold text-resource-dark uppercase tracking-wider block">
                แนวทางใหม่: แชร์ใช้ร่วมผ่าน SME UNLOCK
              </span>
              <div className="text-2xl font-extrabold font-mono text-resource-dark">฿18,500</div>
              <p className="text-[11px] text-ink-muted leading-relaxed">
                แชร์ครัวกลาง GMP ดินแดง, รถกระบะความเย็นรวม 6 ร้าน, และใช้เครื่องซีลสูญญากาศตามชั่วโมงจริง
              </p>
              <div className="text-[11px] text-resource-dark font-bold mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ประหยัดเงินทุนได้ทันที ฿96,500 บาท (-83.9%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: "ทั้งหมด (4 รายการ)" },
            { id: "kitchen", label: "🍳 ครัวกลาง" },
            { id: "truck", label: "🚚 รถขนส่งเย็น" },
            { id: "machine", label: "⚙️ เครื่องจักรแพ็กเกจ" },
            { id: "team", label: "👥 ทีมงานเสริม" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-chip font-medium whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? "bg-resource text-white shadow-xs font-bold"
                  : "bg-white border border-borderLine text-ink hover:border-resource"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Resources Grid with Detach Buttons (Signature S5) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResources.map((res) => {
            const isDetached = detachedResourceIds.includes(res.id);
            return (
              <ResourceTile
                key={res.id}
                resource={res}
                dataKind="actual"
                isDetached={isDetached}
                onToggleDetach={() => handleToggleDetach(res)}
              />
            );
          })}
        </div>
      </div>
    </StateRenderer>
  );
};
