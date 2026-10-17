import React, { useState } from "react";
import { StatementRecord, statementDraft, statementWithYear } from "@/api/statementImport";

const titles = { balance_sheet: "งบฐานะการเงิน", income_statement: "งบกำไรขาดทุน", cash_flow_statement: "งบกระแสเงินสด" };

export function StatementPreview({ records, onImport }: { records: StatementRecord[]; onImport: (draft: Record<string, string>) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [years, setYears] = useState<Record<number, string>>({});
  let draft: Record<string, string> | null = null;
  let error = "";
  try { draft = statementDraft(selected.map((index) => statementWithYear(records[index], years[index] || ""))); }
  catch (reason) { error = reason instanceof Error ? reason.message : "กรุณาตรวจงบที่เลือก"; }
  return <section className="bg-white p-5 rounded-card border border-borderLine space-y-4" aria-label="เลือกงบจาก Excel">
    <h3 className="font-bold text-sm">อ่านไฟล์แล้ว · เลือกงบก่อนนำเข้า</h3>
    <p className="text-xs text-ink-muted">ไฟล์นี้มีหลายงบและหลายงวด เลือกงบจากชีตเดียวกัน ปีเดียวกัน และสกุลเงิน THB ระบบจะไม่รวมข้อมูลต่างสกุลเงินหรือแทนช่องว่างด้วยศูนย์</p>
    <div className="space-y-2">
      {records.map((record, index) => {
        let resolved: StatementRecord | null = null;
        try { resolved = statementWithYear(record, years[index] || ""); } catch { /* Require explicit year for placeholders. */ }
        const canAssignYear = record.currency === "THB" && !record.period.year && !["invalid", "empty_template"].includes(record.status);
        const blocked = record.currency !== "THB" || !resolved?.period.year || ["invalid", "empty_template"].includes(record.status);
        return <div key={`${record.sheet}-${record.section}-${record.column}`} className="p-3 rounded-xl border border-slate-200 text-xs space-y-2">
          <label className="flex gap-2 items-start">
            <input type="checkbox" disabled={blocked} checked={selected.includes(index)} onChange={(event) => { setSelected(event.target.checked ? [...selected, index] : selected.filter((item) => item !== index)); setConfirmed(false); }} />
            <span><strong>{record.sheet} · {titles[record.section]}</strong><br />{record.period.header} · คอลัมน์ {record.column} · {record.currency || "ไม่ระบุสกุลเงิน"} · ตัวคูณหน่วย {record.sourceScale}
              {blocked && <span className="block text-amber-800">{record.currency !== "THB" ? "ดูได้ แต่ยังนำไปคำนวณ THB ไม่ได้" : record.status === "empty_template" ? "แบบฟอร์มว่าง กรุณากรอกปีและข้อมูลจริงในไฟล์ก่อน" : canAssignYear ? "มีข้อมูลแล้ว กรุณาระบุปีบัญชีด้านล่างก่อนเลือก" : "ต้องแก้ปีหรือยอดที่ไม่ตรงกันในไฟล์ก่อน"}</span>}
            </span>
          </label>
          {canAssignYear && <label className="block text-xs">ปีบัญชีของงบนี้ (ค.ศ. หรือ พ.ศ.)
            <input type="text" inputMode="numeric" maxLength={4} aria-label={`ปีบัญชี ${record.sheet} ${titles[record.section]} คอลัมน์ ${record.column}`} placeholder="เช่น 2019 หรือ 2562"
              value={years[index] || ""} className="ml-2 p-2 border rounded-lg"
              onChange={(event) => { setYears({ ...years, [index]: event.target.value }); setConfirmed(false); }} />
            {resolved && <span className="ml-2">ใช้ปี ค.ศ. {resolved.period.year}</span>}
          </label>}
          <details><summary className="cursor-pointer text-brand">ดูข้อมูลที่อ่านได้และผลตรวจสอบ</summary>
            <dl className="grid grid-cols-2 gap-1 mt-2 font-mono">{Object.entries(record.fields).map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value ?? "ไม่ทราบ"}</dd></React.Fragment>)}</dl>
            {record.checks.map((check) => <p key={check.id}>{check.id}: {check.status}</p>)}
            {record.warnings.map((warning) => <p key={warning} className="text-amber-800">{warning}</p>)}
          </details>
        </div>;
      })}
    </div>
    <label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />ฉันยืนยันว่างบที่เลือกเป็นธุรกิจเดียวกันและงวดบัญชีเดียวกัน</label>
    <p className="text-xs text-amber-800" role="status">{error || "ขั้นต่อไป: ตรวจตัวเลขและกรอกวันที่เริ่ม/สิ้นงวดที่ยังขาด แล้วกดยืนยันเพื่อวิเคราะห์"}</p>
    <button type="button" disabled={!draft || !confirmed} className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-btn disabled:opacity-40" onClick={() => draft && onImport(draft)}>นำข้อมูลที่เลือกไปตรวจในแบบฟอร์ม</button>
  </section>;
}
