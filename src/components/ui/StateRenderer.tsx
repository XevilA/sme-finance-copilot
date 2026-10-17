import React from "react";
import { PageStateMode, useAppStore } from "@/store/useAppStore";
import { databaseUnavailable, missingDataLabel } from "@/api/dataAvailability";
import {
  FileQuestion,
  AlertTriangle,
  RefreshCw,
  SearchX,
  Lock,
  Clock,
  CheckCircle2,
  PlusCircle,
  ShieldAlert,
} from "lucide-react";

interface StateRendererProps {
  currentMode?: PageStateMode;
  missingItems?: string[];
  errorMessage?: string;
  /** Shown in the unavailable state: why the backend cannot answer this yet. */
  unavailableReason?: string;
  onRetry?: () => void;
  onAddData?: () => void;
  onClearFilters?: () => void;
  onRequestPermission?: () => void;
  onReanalyze?: () => void;
  children: React.ReactNode;
}

export const StateRenderer: React.FC<StateRendererProps> = ({
  currentMode,
  missingItems = ["มูลค่าสินค้าคงเหลือของสด", "รอบชำระหนี้เฉลี่ย"],
  errorMessage = "ไม่สามารถเชื่อมต่อฐานข้อมูลคำนวณของทีม IT ได้ในขณะนี้",
  unavailableReason = "ระบบหลังบ้านยังไม่มีข้อมูลหรือยังไม่รองรับการทำรายการนี้",
  onRetry,
  onAddData,
  onClearFilters,
  onRequestPermission,
  onReanalyze,
  children,
}) => {
  const globalMode = useAppStore((s) => s.pageStateMode);
  const effectiveMode = currentMode || globalMode;

  if (["error", "insufficient_data", "unavailable"].includes(effectiveMode) && databaseUnavailable(missingItems, errorMessage)) {
    return <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-card border border-borderLine m-4">
      <ShieldAlert className="w-10 h-10 text-ink-muted mb-4" />
      <h3 className="text-base font-display font-bold text-ink mb-2">หน้านี้ต้องเชื่อมฐานข้อมูลออนไลน์ก่อน</h3>
      <p className="text-xs text-ink-muted max-w-lg leading-relaxed">เว็บนี้ยังไม่ได้เชื่อมฐานข้อมูลสำหรับรายการร้านค้า ออเดอร์ แหล่งทุน และโครงการ การอัปโหลด Excel ใช้คำนวณงบการเงินได้ แต่ยังไม่มีรายการเหล่านี้ให้หน้านี้เรียกใช้</p>
      <p className="text-xs text-ink-muted max-w-lg mt-3">ผู้ดูแลต้องเชื่อมฐานข้อมูลและเพิ่มรายการที่เกี่ยวข้องก่อน แล้วจึงโหลดหน้านี้ใหม่</p>
      {onRetry && <button type="button" onClick={onRetry} className="mt-5 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-btn text-xs font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4" />ตรวจการเชื่อมต่ออีกครั้ง</button>}
    </div>;
  }

  // 1. Normal State -> Render full page children
  if (effectiveMode === "normal") {
    return <>{children}</>;
  }

  // 2. Loading State -> Skeleton Shimmer
  if (effectiveMode === "loading") {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200/80 rounded-xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-200/70 rounded-card" />
          <div className="h-28 bg-slate-200/70 rounded-card" />
          <div className="h-28 bg-slate-200/70 rounded-card" />
          <div className="h-28 bg-slate-200/70 rounded-card" />
        </div>
        <div className="h-80 bg-slate-200/60 rounded-card" />
        <div className="h-48 bg-slate-200/50 rounded-card" />
      </div>
    );
  }

  // 1. Empty State -> Custom Illustration (Empty card with dashed links)
  if (effectiveMode === "empty") {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
        {/* Custom Empty Blueprint Illustration */}
        <div className="relative w-48 h-32 mb-6 flex items-center justify-center">
          <div className="w-24 h-20 rounded-card border-2 border-dashed border-brand/40 bg-white/60 flex items-center justify-center">
            <span className="text-brand font-mono text-xs">ว่างเปล่า</span>
          </div>
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-10 rounded-xl border border-dashed border-slate-300 bg-slate-50" />
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-10 rounded-xl border border-dashed border-slate-300 bg-slate-50" />
          {/* Dashed connecting lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1="20" y1="64" x2="60" y2="64" stroke="#6C4CF1" strokeDasharray="3 3" />
            <line x1="130" y1="64" x2="170" y2="64" stroke="#6C4CF1" strokeDasharray="3 3" />
          </svg>
        </div>

        <h3 className="text-lg font-display font-bold text-ink mb-1">
          ยังไม่มีข้อมูลในหน้านี้
        </h3>
        <p className="text-sm text-ink-muted max-w-md mb-6 leading-relaxed">
          เริ่มต้นสร้างโอกาสธุรกิจด้วยการนำเข้าข้อมูลร้าน หรือทดลองโหลดข้อมูลตัวอย่างโครงการอาหารกล่อง 300 กล่อง
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAddData}
            className="px-5 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-btn text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>เริ่มนำเข้าข้อมูล</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Insufficient Data -> Rule #3: Never show 0, specify missing fields
  if (effectiveMode === "insufficient_data") {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-amber-50/40 rounded-card border border-amber-200/80 m-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-attention flex items-center justify-center mb-4">
          <FileQuestion className="w-7 h-7" />
        </div>
        <h3 className="text-base font-display font-bold text-amber-900 mb-2">
          คำนวณไม่ได้ ข้อมูลยังไม่เพียงพอ
        </h3>
        <p className="text-xs text-amber-800 mb-4 max-w-md">
          ระบบปฏิบัติตามกฎเหล็ก: จะไม่คาดเดาตัวเลขหรือแสดงค่าเป็น 0 หากข้อมูลตั้งต้นไม่ครบถ้วน
        </p>
        <div className="bg-white p-4 rounded-xl border border-amber-200 text-left mb-6 max-w-sm w-full shadow-soft-sm">
          <span className="text-[11px] font-bold text-amber-900 block mb-2">
            รายการข้อมูลที่ระบบยังขาด:
          </span>
          <ul className="text-xs text-ink-muted space-y-1.5 list-disc pl-4">
            {missingItems.map((item, idx) => (
              <li key={idx} className="font-medium text-amber-900">
                {missingDataLabel(item)}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={onAddData}
          className="px-4 py-2 bg-attention hover:bg-attention-dark text-white rounded-btn text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>เพิ่มข้อมูลที่ยังขาด</span>
        </button>
      </div>
    );
  }

  // 3b. Unavailable -> The backend answered and declared it has no evidence or
  // no operation for this view. Never rendered as zero and never as success.
  if (effectiveMode === "unavailable") {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-card border border-borderLine m-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-ink-muted flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h3 className="text-base font-display font-bold text-ink mb-2">
          ยังไม่มีข้อมูลให้แสดงในหน้านี้
        </h3>
        <p className="text-xs text-ink-muted mb-4 max-w-md leading-relaxed">{unavailableReason}</p>
        {missingItems.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-borderLine text-left mb-6 max-w-sm w-full shadow-soft-sm">
            <span className="text-[11px] font-bold text-ink block mb-2">
              หลักฐานที่ระบบยังไม่มี:
            </span>
            <ul className="text-xs text-ink-muted space-y-1.5 list-disc pl-4">
              {missingItems.map((item, idx) => (
                <li key={idx} className="font-mono text-[11px]">
                  {missingDataLabel(item)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {onAddData && <button
          type="button"
          onClick={onAddData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-ink rounded-btn text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>ไปหน้านำเข้าข้อมูล</span>
        </button>}
      </div>
    );
  }

  // 4. Error / Unsuccessful Save -> Error message + Retry
  if (effectiveMode === "error") {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-rose-50/50 rounded-card border border-rose-200 m-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-danger flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-display font-bold text-rose-900 mb-1">
          การประมวลผลไม่สำเร็จ
        </h3>
        <p className="text-xs text-rose-700 mb-6 max-w-md">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 bg-danger hover:bg-danger-dark text-white rounded-btn text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>ลองใหม่อีกครั้ง</span>
        </button>
      </div>
    );
  }

  // 5. Not Found -> Clear filter
  if (effectiveMode === "not_found") {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-card border border-borderLine m-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-ink-muted flex items-center justify-center mb-4">
          <SearchX className="w-7 h-7" />
        </div>
        <h3 className="text-base font-display font-bold text-ink mb-1">
          ไม่พบรายการที่ตรงกับเงื่อนไข
        </h3>
        <p className="text-xs text-ink-muted mb-6 max-w-sm">
          ลองปรับตัวกรองพื้นที่ กำลังผลิตว่าง หรือช่วงราคาเพื่อค้นหาผลลัพธ์ใหม่
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-ink rounded-btn text-xs font-semibold flex items-center gap-1.5 transition-all"
        >
          <span>ล้างตัวกรองทั้งหมด</span>
        </button>
      </div>
    );
  }

  // 6. No Permission -> Request access
  if (effectiveMode === "no_permission") {
    return (
      <div className="min-h-[460px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-card border border-borderLine m-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-ink-muted flex items-center justify-center mb-4">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-display font-bold text-ink mb-1">
          ไม่มีสิทธิ์เข้าถึงข้อมูลเชิงลึก
        </h3>
        <p className="text-xs text-ink-muted mb-6 max-w-md">
          ข้อมูลสัญญาและเอกสารแนบสงวนสิทธิ์เฉพาะร้านค้าที่ได้รับการยอมรับในกลุ่ม SWARM หรือผู้ให้ทุนที่ผ่านการยืนยันตัวตน
        </p>
        <button
          type="button"
          onClick={onRequestPermission}
          className="px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-btn text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>ส่งคำขอสิทธิ์เข้าถึงข้อมูล</span>
        </button>
      </div>
    );
  }

  // 7. Stale Result -> Warning banner on top of children
  if (effectiveMode === "stale") {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-attention shrink-0" />
            <span>
              <strong>ผลลัพธ์ล้าสมัย:</strong> ข้อมูลตั้งต้นหรือสัดส่วนงานมีการเปลี่ยนแปลงหลังการวิเคราะห์ล่าสุด
            </span>
          </div>
          <button
            type="button"
            onClick={onReanalyze}
            className="px-3 py-1 bg-brand text-white rounded-lg text-xs font-medium hover:bg-brand-dark flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>วิเคราะห์ใหม่</span>
          </button>
        </div>
        {children}
      </div>
    );
  }

  // 8. Success State -> Stroke draw checkmark banner
  if (effectiveMode === "success") {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><strong>บันทึกสำเร็จ:</strong> อัปเดตข้อมูลและแผนงานเรียบร้อยแล้ว</span>
        </div>
        {children}
      </div>
    );
  }

  // 9. Unsaved Changes -> Indicator on top of children
  if (effectiveMode === "unsaved") {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
            <span><strong>มีรายการจำลองที่ยังไม่บันทึก:</strong> ข้อมูลนี้อยู่ในโหมดแซนด์บ็อกซ์ ยังไม่กระทบข้อมูลจริง</span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
            โหมดจำลอง
          </span>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
};
