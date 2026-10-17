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
      act: "ฉากที่ 1",
      title: "โอกาสทางธุรกิจขนาดใหญ่: คำสั่งซื้ออาหาร 300 กล่อง/วัน",
      subtitle: "โจทย์จาก บจก.สยามเทคโนพาร์ค ระยะเวลา 10 วันทำการ รวม 3,000 กล่อง งบประมาณ 255,000 ฿",
      highlightMetric: "300 กล่อง/วัน × 10 วัน",
      metricLabel: "มูลค่าโครงการรวม ฿255,000",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-navy-border space-y-4 max-w-xl mx-auto text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-glow font-semibold tracking-wider uppercase">
              ความท้าทายของ SME ทั่วไป
            </span>
            <DataKindBadge kind="actual" size="sm" />
          </div>
          <p className="text-sm text-slate-200 leading-relaxed">
            ร้านอาหารรายย่อยเดี่ยวๆ ไม่สามารถรับงานใหญ่ระดับ 300 กล่อง/วัน ได้ด้วยตัวเองเนื่องจากกำลังผลิตและพื้นที่ครัวมีจำกัด (เฉลี่ยทำได้เพียง 50–70 กล่อง/วัน) หากปฏิเสธก็จะสูญเสียโอกาสรายได้ก้อนโต
          </p>
          <div className="p-3 bg-navy-card rounded-xl border border-navy-border flex items-center justify-between text-xs">
            <span className="text-slate-300">มาตรฐานที่กำหนด:</span>
            <span className="text-white font-medium">กล่องรักษ์โลกย่อยสลายได้ · ส่งถึงจุดก่อน 11:15 น.</span>
          </div>
        </div>
      ),
    },
    {
      act: "ฉากที่ 2",
      title: "SME SWARM รวมทีม: ระบบประกอบ 6 ร้านร่วมรับงาน",
      subtitle: "ระบบกวาดร้านที่มีกำลังผลิตว่างในรัศมีใกล้เคียง แบ่งงานร้านละ 50 กล่อง/วัน",
      highlightMetric: "6 ร้าน × 50 กล่อง",
      metricLabel: "กำลังผลิตรวม 300 กล่อง/วัน (ครบ 100%)",
      content: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
          {[
            { name: "ร้านบ้านข้าวหอม", role: "ข้าวหอมไก่อบ", gap: "ขาด ฿14,000" },
            { name: "ครัวป้าสมร", role: "กะเพราโบราณ", gap: "เงินสดพร้อม" },
            { name: "เจ๊ดาวแกงปักษ์ใต้", role: "แกงใต้รสเด็ด", gap: "ขาด ฿15,500" },
            { name: "เฮียฮงหมูกรอบ", role: "หมูกรอบเตาถ่าน", gap: "เงินสดพร้อม" },
            { name: "ครัวสวนผัก", role: "อกไก่ออร์แกนิค", gap: "เงินสดพร้อม" },
            { name: "ปิ่นโตแม่เพ็ญ", role: "พะโล้คุณย่า", gap: "เงินสดพร้อม" },
          ].map((s, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-navy-surface border border-navy-border text-xs">
              <div className="font-semibold text-white truncate">{s.name}</div>
              <div className="text-[11px] text-slate-400">{s.role} (50 กล่อง)</div>
              <div className={`text-[10px] mt-2 font-mono font-bold ${s.gap.includes("ขาด") ? "text-danger" : "text-emerald-400"}`}>
                {s.gap}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      act: "ฉากที่ 3",
      title: "จุดสะดุดของโครงการ: 2 ร้านขาดเงินทุนหมุนเวียนล่วงหน้า",
      subtitle: "ระบบเจาะลึกกระแสเงินสดรายร้าน พบว่ามี 2 ร้านไม่สามารถเริ่มผลิตได้หากไม่มีเงินก้อนแรก",
      highlightMetric: "฿29,500",
      metricLabel: "เงินสดหมุนเวียนที่ยังขาดรวม (ร้านบ้านข้าวหอม + เจ๊ดาว)",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-danger/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-danger">
          <div className="flex items-center gap-2 text-danger font-bold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>โครงการติดตรงไหน (Bottleneck Spotlight)</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            แม้คำนวณแล้วทุกร้านจะได้กำไรสุทธิเฉลี่ย 11,000–12,500 บาท แต่ร้านบ้านข้าวหอมต้องจ่ายค่าข้าวและเนื้อไก่สด 18,000 บาท ในวันแรก ขณะที่มีเงินสดติดตัวเพียง 10,000 บาท (ขาด 14,000 ฿) และเจ๊ดาวขาด 15,500 ฿
          </p>
          <div className="p-3 bg-red-950/40 rounded-xl border border-danger/30 text-xs text-red-200 flex items-center justify-between">
            <span>สถานะระบบ:</span>
            <span className="font-bold text-danger">ห้ามกดเริ่มงานจนกว่าจะปิดช่องว่างเงินทุน</span>
          </div>
        </div>
      ),
    },
    {
      act: "ฉากที่ 4",
      title: "ปลดล็อกเงินทุน: เชื่อมต่อ Invoice Factoring ใน 24 ชม.",
      subtitle: "ใช้ใบสั่งซื้อ (PO) ที่ยืนยันแล้ว ขอเบิกเงินสดล่วงหน้า 85% โดยไม่ต้องใช้หลักทรัพย์ค้ำประกัน",
      highlightMetric: "24 ชั่วโมง",
      metricLabel: "อนุมัติเงินสด ฿29,500 ดอกเบี้ย 8.5% ต่อปี",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-resource/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-resource">
          <div className="flex items-center gap-2 text-resource font-bold text-sm">
            <Coins className="w-4 h-4 shrink-0" />
            <span>จับคู่ทุนสำเร็จ: แฟกทอริงเฉพาะโครงการ</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            ผู้ให้ทุนปล่อยเงินหมุนเวียน 14,000 บาทให้ร้านบ้านข้าวหอม และ 15,500 บาทให้เจ๊ดาว ทำให้ทั้ง 6 ร้านมีเงินสดในมือครอบคลุมค่าวัตถุดิบตั้งแต่วันแรก โครงการพร้อมเดินเครื่อง 100%
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-navy-card border border-navy-border">
              <span className="text-slate-400 block text-[10px]">ดอกเบี้ยรวมตลอดงาน</span>
              <span className="text-white font-bold font-mono">฿209.50 (คิดตามวันจริง)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-navy-card border border-navy-border">
              <span className="text-slate-400 block text-[10px]">วันรับเงินสด</span>
              <span className="text-resource font-bold">1 พ.ย. (ทันรอบวัตถุดิบ)</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      act: "ฉากที่ 5",
      title: "ซ้อมรับมือวิกฤติ: จำลองร้านถอนตัวกะทันหัน",
      subtitle: "ระบบทดสอบฉากจำลอง (Chaos Rehearsal) หากเจ๊ดาวถอนตัวกะทันหันในวันที่ 2",
      highlightMetric: "4 ช่วงเหตุการณ์",
      metricLabel: "เกิดเหตุ → ลามตามเส้น → เงินสดดิ่ง → ทางเลือกสำรอง",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-attention/40 max-w-xl mx-auto text-left space-y-4">
          <div className="flex items-center gap-2 text-attention font-bold text-sm">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>แผนสำรองอัตโนมัติ (Contingency Option)</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            คลื่นสีแดงไหลไปตามเส้นเชื่อมโยง แสดงให้เห็นว่าหากไม่ทำอะไร งานจะขาด 50 กล่อง/วัน และเสียค่าปรับส่งช้า 10,000 บาท แต่ระบบดึง 'ครัวร่มไทร' (ร้านสำรองอันดับ 1) เข้ามาสลับแทนที่ได้ในคลิกเดียว
          </p>
          <div className="p-3 bg-navy-card rounded-xl border border-navy-border flex items-center justify-between text-xs">
            <span className="text-slate-300">ผลการซ้อมแผนพัง:</span>
            <span className="text-emerald-400 font-bold">ป้องกันความเสียหายได้ 100%</span>
          </div>
        </div>
      ),
    },
    {
      act: "ฉากที่ 6",
      title: "บทสรุปและผลสัมฤทธิ์: ทุกร้านเหลือกำไรจริง",
      subtitle: "ส่งมอบครบ 3,000 กล่อง ได้รับเงินชำระครบถ้วน ปิดโครงการตามมาตรฐาน ESG",
      highlightMetric: "฿69,000",
      metricLabel: "กำไรสุทธิรวมที่กระจายสู่ 6 ชุมชน (เฉลี่ย ฿11,500/ร้าน)",
      content: (
        <div className="bg-navy-surface p-6 rounded-card border border-brand/40 max-w-xl mx-auto text-left space-y-4 shadow-glow-primary">
          <div className="flex items-center gap-2 text-brand-glow font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>ตัวชี้วัดเป้าหมายในบทนำเสนอ (ยังไม่ได้วัดจากระบบ)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">อัตราส่งมอบตรงเวลา (เป้าหมาย)</span>
              <span className="text-sm font-bold text-emerald-400">ยังไม่ได้วัด</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">ต้นทุนโลจิสติกส์ลดลง (เป้าหมาย)</span>
              <span className="text-sm font-bold text-resource">ยังไม่ได้วัด</span>
            </div>
            <div className="p-3 rounded-xl bg-navy-card border border-navy-border">
              <span className="text-[10px] text-slate-400 block">หนี้เสีย (NPL) (เป้าหมาย)</span>
              <span className="text-sm font-bold text-emerald-400">ยังไม่ได้วัด</span>
            </div>
          </div>
          <p className="text-xs text-slate-300 text-center leading-relaxed">
            "SME Finance Copilot เปลี่ยนจากการอ่านรายงานแห้งๆ เป็นห้องประกอบโอกาสธุรกิจที่จับต้องได้จริง"
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
            บทนำเสนอที่เขียนไว้ล่วงหน้า · ตัวเลขในฉากเป็นตัวอย่างประกอบคำบรรยาย ไม่ใช่ผลคำนวณจากระบบ
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
              title={`ฉากที่ ${idx + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStoryModeOpen(false)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-surface rounded-lg transition-colors flex items-center gap-1 text-xs"
        >
          <span>ออกจากโหมดเล่า (Esc)</span>
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
          <span>เริ่มใหม่จากฉาก 1</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={prevStoryScene}
            disabled={storyCurrentScene === 1}
            className="px-4 py-2 rounded-btn bg-navy-surface border border-navy-border text-slate-200 hover:bg-navy-card disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ย้อนกลับ (←)</span>
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
            <span>{storyCurrentScene === scenes.length ? "เสร็จสิ้น (ออก)" : "ถัดไป (→ / Space)"}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          กด Spacebar หรือลูกศรขวาเพื่อไปต่อ
        </div>
      </div>
    </div>
  );
};
