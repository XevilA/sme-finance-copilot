import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAppStore, NavPage } from "@/store/useAppStore";
import { apiClient } from "@/api/client";
import { FundingOption, Shop, UnlockResource } from "@/api/contracts/types";
import { useEnvelope } from "@/hooks/useEnvelope";
import {
  Search,
  Store,
  Briefcase,
  Wrench,
  Coins,
  FileText,
  Compass,
  ArrowRight,
  X,
} from "lucide-react";

type SearchResultItem = {
  id: string;
  category: "ร้านค้า" | "โครงการ" | "ทรัพยากร" | "แหล่งทุน" | "เมนู";
  title: string;
  subtitle: string;
  targetPage: NavPage;
  targetShopId?: string;
};

const searchableMenu: SearchResultItem[] = [
  // Menu items
  { id: "m-1", category: "เมนู", title: "ภาพรวมธุรกิจ", subtitle: "ดูรายได้ กำไร เงินสด และเรื่องที่ควรทำต่อ", targetPage: "overview" },
  { id: "m-2", category: "เมนู", title: "ข้อมูลธุรกิจ & นำเข้าไฟล์", subtitle: "อัปโหลด Excel หรือกรอกงบการเงิน 8 หมวด", targetPage: "import" },
  { id: "m-3", category: "เมนู", title: "เงินสดและกระแสเงินสด (Time Travel)", subtitle: "เลื่อนดูอนาคตของร้าน 30–90 วัน", targetPage: "cashflow" },
  { id: "m-4", category: "เมนู", title: "สุขภาพการเงิน", subtitle: "วิเคราะห์สภาพคล่อง กำไร หนี้สิน และประสิทธิภาพ", targetPage: "health" },
  { id: "m-5", category: "เมนู", title: "ต้นทุนและความคุ้มค่า", subtitle: "ต้นทุนต่อหน่วย จุดคุ้มทุน และแผนลงทุน A/B", targetPage: "cost" },
  { id: "m-6", category: "เมนู", title: "ยอดขายและสินค้า", subtitle: "ยอดขาย กำไร แยกตามสินค้าและช่องทาง", targetPage: "sales" },
  { id: "m-7", category: "เมนู", title: "จับคู่แหล่งเงินทุน", subtitle: "ค้นหาทางเลือกทุนและจำลองค่างวด", targetPage: "funding" },
  { id: "m-8", category: "เมนู", title: "SME SWARM รวมทีมรับงาน", subtitle: "จัดสรรออเดอร์ให้กลุ่มร้านตามกำลังผลิตและทรัพยากรที่บันทึกไว้", targetPage: "swarm" },
  { id: "m-9", category: "เมนู", title: "แผนเงินรายร้านในทีม", subtitle: "ตรวจกระแสเงินสดรายร้าน และลงนามยอมรับแผน", targetPage: "shop-finance" },
  { id: "m-10", category: "เมนู", title: "SME UNLOCK ปลดล็อกทรัพยากร", subtitle: "แชร์ครัว รถส่งของ เครื่องจักร และแรงงาน", targetPage: "unlock" },
  { id: "m-11", category: "เมนู", title: "ฝั่งผู้ให้ทุน (Funder Portal)", subtitle: "ดูโครงการที่บันทึกไว้พร้อมระดับหลักฐาน", targetPage: "funder" },
  { id: "m-12", category: "เมนู", title: "ห้องจำลอง & ซ้อมแผนพัง (Chaos)", subtitle: "ซ้อมวันที่ทุกอย่างพัง เล่นเหตุการณ์ 4 ช่วง", targetPage: "simulator" },
  { id: "m-13", category: "เมนู", title: "โครงการ & รายงาน", subtitle: "สรุปผลจริงเทียบแผนที่บันทึกไว้", targetPage: "projects" },

  // Shop, resource and funding entries are loaded from the backend below, so
  // the palette never navigates to an identifier no stored record matches.
];

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setCurrentPage } = useAppStore();
  const shopState = useEnvelope<Shop[]>(useCallback(() => apiClient.getShops(), []));
  const resourceState = useEnvelope<UnlockResource[]>(useCallback(() => apiClient.getUnlockResources(), []));
  const fundingState = useEnvelope<FundingOption[]>(useCallback(() => apiClient.getFundingOptions(), []));
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === "Escape" && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Menu entries plus the shops, resources and funding products the backend
  // returned. Each record carries its own UUID and its own figures.
  const money = (value: number) => `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
  const catalogue: SearchResultItem[] = [
    ...searchableMenu,
    ...(shopState.envelope?.data || []).map((shop) => ({
      id: `shop-${shop.id}`,
      category: "ร้านค้า" as const,
      title: shop.name,
      subtitle: `กำลังผลิตว่าง ${shop.capacityAvailable} ${shop.unit}`
        + (shop.fundingGap > 0 ? ` · ขาดทุนหมุนเวียน ${money(shop.fundingGap)}` : " · ไม่มีส่วนที่ขาดบันทึกไว้")
        + ` · ${shop.location}`,
      targetPage: "shop-finance" as NavPage,
      targetShopId: shop.id,
    })),
    ...(resourceState.envelope?.data || []).map((resource) => ({
      id: `resource-${resource.id}`,
      category: "ทรัพยากร" as const,
      title: resource.title,
      subtitle: `${resource.capacityText} · ${resource.priceText} · `
        + (resource.status === "confirmed" ? "ยืนยันแล้ว" : "ยังเป็นข้อเสนอ"),
      targetPage: "unlock" as NavPage,
    })),
    ...(fundingState.envelope?.data || []).map((option) => ({
      id: `funding-${option.id}`,
      category: "แหล่งทุน" as const,
      title: option.name,
      subtitle: `${option.typeLabel} · ${option.provider} · ดอกเบี้ย ${option.interestRateAnnual}% ต่อปี`
        + ` · รับเงินใน ${option.disbursementDays} วัน`,
      targetPage: "funding" as NavPage,
    })),
  ];

  const filtered = query.trim()
    ? catalogue.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : catalogue.slice(0, 8);

  const handleSelect = (item: SearchResultItem) => {
    setCurrentPage(item.targetPage, { shopId: item.targetShopId });
    setCommandPaletteOpen(false);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "ร้านค้า":
        return <Store className="w-4 h-4 text-brand" />;
      case "โครงการ":
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case "ทรัพยากร":
        return <Wrench className="w-4 h-4 text-resource-dark" />;
      case "แหล่งทุน":
        return <Coins className="w-4 h-4 text-amber-500" />;
      default:
        return <Compass className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-deep/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-fade-in"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-card shadow-soft-lg border border-borderLine overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-borderLine">
          <Search className="w-5 h-5 text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ค้นหาชื่อร้าน, เมนู, 'ครัวว่าง', แหล่งทุน, โครงการ... (กด Esc เพื่อปิด)"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted outline-none font-sans"
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 text-ink-muted hover:text-ink rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              ไม่พบผลการค้นหาสำหรับ "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                  idx === selectedIndex ? "bg-brand/10 text-brand" : "hover:bg-slate-50 text-ink"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>{item.title}</span>
                      <span className="text-[10px] text-ink-muted font-normal bg-slate-100 px-1.5 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted line-clamp-1">{item.subtitle}</div>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-ink-muted">
          <span>กด <strong>Enter</strong> เพื่อเลือก</span>
          <span className="font-mono">⌘K เพื่อเปิดได้ตลอดเวลา</span>
        </div>
      </div>
    </div>
  );
};
