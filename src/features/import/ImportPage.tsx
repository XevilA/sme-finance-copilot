import React, { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { DataKindBadge } from "@/components/signature/DataKindBadge";
import { StateRenderer } from "@/components/ui/StateRenderer";
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  Check,
} from "lucide-react";

export const ImportPage: React.FC = () => {
  const { setCurrentPage, addToast } = useAppStore();
  const [activeTab, setActiveTab] = useState<"upload" | "manual" | "saved">("manual");
  const [activeSection, setActiveSection] = useState<number>(1);

  // Stepper Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<"idle" | "reading" | "validating" | "analyzing">("idle");

  const sections = [
    { id: 1, title: "1. ข้อมูลทั่วไปและประเภทธุรกิจ", status: "complete" },
    { id: 2, title: "2. รายได้และค่าใช้จ่าย", status: "complete" },
    { id: 3, title: "3. เงินสดคงเหลือและบัญชีธนาคาร", status: "complete" },
    { id: 4, title: "4. สินทรัพย์ หนี้สิน และส่วนทุน", status: "complete" },
    { id: 5, title: "5. ลูกหนี้การค้าและเจ้าหนี้การค้า", status: "complete" },
    { id: 6, title: "6. สินค้าคงคลังของสด (สต็อก)", status: "incomplete" }, // Shows Rule #3 demonstration!
    { id: 7, title: "7. ภาระผ่อนและวันครบกำหนด", status: "complete" },
    { id: 8, title: "8. สินค้าหลักและสัดส่วนยอดขาย", status: "complete" },
  ];

  const handleStartAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisStep("reading");
    setTimeout(() => {
      setAnalysisStep("validating");
      setTimeout(() => {
        setAnalysisStep("analyzing");
        setTimeout(() => {
          setIsAnalyzing(false);
          addToast({
            type: "success",
            title: "วิเคราะห์ข้อมูลสำเร็จ",
            message: "อัปเดตโมเดลการเงินและสุขภาพธุรกิจเรียบร้อยแล้ว",
          });
          setCurrentPage("overview");
        }, 800);
      }, 700);
    }, 600);
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 text-ink animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-borderLine pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-display font-bold text-ink">
              ข้อมูลธุรกิจ & นำเข้าไฟล์ (Business Data Input)
            </h1>
            <DataKindBadge kind="actual" size="md" />
          </div>
          <p className="text-xs text-ink-muted mt-0.5">
            อัปโหลดไฟล์สเปรดชีต Excel/CSV หรือกรอกแบบฟอร์ม 8 หมวดเพื่อสร้างฐานข้อมูลจริง
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "upload" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            อัปโหลดไฟล์ Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "manual" ? "bg-white text-brand shadow-2xs" : "text-ink-muted"
            }`}
          >
            กรอกเอง 8 หมวด
          </button>
        </div>
      </div>

      {/* Mode 1: File Dropzone & Column Mapping */}
      {activeTab === "upload" ? (
        <div className="space-y-6">
          <div className="p-8 border-2 border-dashed border-borderLine hover:border-brand rounded-card bg-white text-center space-y-3 transition-colors cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-ink">
                ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                รองรับไฟล์ .XLSX, .XLS, .CSV ขนาดไม่เกิน 25MB
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn hover:bg-brand-dark"
              >
                เลือกไฟล์จากเครื่อง
              </button>
              <button
                type="button"
                className="px-3.5 py-2 border border-slate-200 text-ink text-xs font-medium rounded-btn hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลดแบบฟอร์มตัวอย่าง (Template)</span>
              </button>
            </div>
          </div>

          {/* Sample Column Mapping Preview */}
          <div className="bg-white p-5 rounded-card border border-borderLine space-y-3">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-ink">
              จับคู่คอลัมน์ข้อมูล (Column Mapping Interface)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Date</span>
                <span className="font-bold text-ink">↔ วันที่ทำรายการ</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Sales</span>
                <span className="font-bold text-ink">↔ ยอดขาย / รายได้</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Cost</span>
                <span className="font-bold text-ink">↔ ต้นทุนขาย</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-[10px] text-ink-muted block">คอลัมน์ในไฟล์: Cash_Balance</span>
                <span className="font-bold text-ink">↔ เงินสดคงเหลือ</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: 8-Section Long Manual Form with Sticky Nav */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sticky Left Section Nav */}
          <div className="lg:col-span-4 bg-white p-4 rounded-card border border-borderLine shadow-soft-sm sticky top-24 space-y-2">
            <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block px-1">
              หมวดหมู่งบการเงิน 8 หมวด
            </span>
            <div className="space-y-1">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all ${
                    activeSection === sec.id
                      ? "bg-brand/10 text-brand font-bold border border-brand/20"
                      : "hover:bg-slate-50 text-ink"
                  }`}
                >
                  <span className="truncate">{sec.title}</span>
                  {sec.status === "complete" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-attention shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Validation & Submit Button */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className="w-full py-2.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>{isAnalyzing ? "กำลังประมวลผล..." : "ยืนยันข้อมูลและเริ่มวิเคราะห์"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Form Content Area */}
          <div className="lg:col-span-8 bg-white p-6 rounded-card border border-borderLine shadow-soft-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="font-display font-bold text-sm text-ink">
                หมวดที่ {activeSection}: {sections.find((s) => s.id === activeSection)?.title}
              </h3>
              <span className="text-xs text-ink-muted font-medium">บันทึกร่างอัตโนมัติ</span>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-ink block mb-1">ชื่อสถานประกอบการ / ร้านค้า</label>
                <input
                  type="text"
                  defaultValue="ร้านบ้านข้าวหอม (สาขาหลัก จตุจักร)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">ยอดขายเฉลี่ยต่อเดือน (฿)</label>
                <input
                  type="number"
                  defaultValue={148500}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">เงินสดคงเหลือในบัญชีวันนี้ (฿)</label>
                <input
                  type="number"
                  defaultValue={10000}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-ink block mb-1">เงินสำรองขั้นต่ำที่ต้องการ (฿)</label>
                <input
                  type="number"
                  defaultValue={15000}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand font-mono font-bold"
                />
              </div>
            </div>

            {/* Row Validation Alert Demonstration (Part B Rule #3) */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-attention mt-0.5 shrink-0" />
              <div>
                <strong>การแจ้งเตือนความสมบูรณ์:</strong> ข้อมูลหมวดที่ 6 (สต็อกของสด) ยังไม่ได้กรอก{" "}
                ระบบจะไม่เดาค่าเป็น 0 แต่จะระบุว่าขาดข้อมูลเพื่อความโปร่งใส
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stepper Modal during analysis */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-navy-deep/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-card shadow-soft-lg p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mx-auto animate-spin">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ink text-sm">
                กำลังวิเคราะห์ข้อมูลธุรกิจ
              </h3>
              <p className="text-xs text-ink-muted mt-1">
                {analysisStep === "reading" && "1/3: กำลังอ่านโครงสร้างข้อมูลและแถวรายการ..."}
                {analysisStep === "validating" && "2/3: กำลังตรวจสอบดุลบัญชีและความสัมพันธ์..."}
                {analysisStep === "analyzing" && "3/3: ประมวลผลดัชนีสุขภาพการเงินและกระแสเงินสด..."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
