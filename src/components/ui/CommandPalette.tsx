import React, { useState, useEffect, useRef } from "react";
import { useAppStore, NavPage } from "@/store/useAppStore";
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

const searchableDatabase: SearchResultItem[] = [
  // Menu items
  { id: "m-1", category: "เมนู", title: "ภาพรวมธุรกิจ", subtitle: "ดูรายได้ กำไร เงินสด และเรื่องที่ควรทำต่อ", targetPage: "overview" },
  { id: "m-2", category: "เมนู", title: "ข้อมูลธุรกิจ & นำเข้าไฟล์", subtitle: "อัปโหลด Excel หรือกรอกงบการเงิน 8 หมวด", targetPage: "import" },
  { id: "m-3", category: "เมนู", title: "เงินสดและกระแสเงินสด (Time Travel)", subtitle: "เลื่อนดูอนาคตของร้าน 30–90 วัน", targetPage: "cashflow" },
  { id: "m-4", category: "เมนู", title: "สุขภาพการเงิน", subtitle: "วิเคราะห์สภาพคล่อง กำไร หนี้สิน และประสิทธิภาพ", targetPage: "health" },
  { id: "m-5", category: "เมนู", title: "ต้นทุนและความคุ้มค่า", subtitle: "ต้นทุนต่อหน่วย จุดคุ้มทุน และแผนลงทุน A/B", targetPage: "cost" },
  { id: "m-6", category: "เมนู", title: "ยอดขายและสินค้า", subtitle: "ยอดขาย กำไร แยกตามสินค้าและช่องทาง", targetPage: "sales" },
  { id: "m-7", category: "เมนู", title: "จับคู่แหล่งเงินทุน", subtitle: "ค้นหาทางเลือกทุนและจำลองค่างวด", targetPage: "funding" },
  { id: "m-8", category: "เมนู", title: "SME SWARM รวมทีมรับงาน", subtitle: "จัดสรรโควตา 6 ร้าน อาหาร 300 กล่อง/วัน", targetPage: "swarm" },
  { id: "m-9", category: "เมนู", title: "แผนเงินรายร้านในทีม", subtitle: "ตรวจกระแสเงินสดรายร้าน และลงนามยอมรับแผน", targetPage: "shop-finance" },
  { id: "m-10", category: "เมนู", title: "SME UNLOCK ปลดล็อกทรัพยากร", subtitle: "แชร์ครัว รถส่งของ เครื่องจักร และแรงงาน", targetPage: "unlock" },
  { id: "m-11", category: "เมนู", title: "ฝั่งผู้ให้ทุน (Funder Portal)", subtitle: "ค้นหาโครงการและจำลองจัดสรรงบ", targetPage: "funder" },
  { id: "m-12", category: "เมนู", title: "ห้องจำลอง & ซ้อมแผนพัง (Chaos)", subtitle: "ซ้อมวันที่ทุกอย่างพัง เล่นเหตุการณ์ 4 ช่วง", targetPage: "simulator" },
  { id: "m-13", category: "เมนู", title: "โครงการ & รายงาน", subtitle: "สรุปผลจริงเทียบแผน และส่งออกเอกสาร", targetPage: "projects" },

  // Shops
  { id: "s-1", category: "ร้านค้า", title: "ร้านบ้านข้าวหอม", subtitle: "ว่าง 50 กล่อง/วัน (ขาดทุนหมุนเวียน ฿14,000)", targetPage: "shop-finance", targetShopId: "shop-1" },
  { id: "s-2", category: "ร้านค้า", title: "ครัวป้าสมร อาหารไทยต้นตำรับ", subtitle: "ว่าง 50 กล่อง/วัน (พร้อมรับงาน)", targetPage: "shop-finance", targetShopId: "shop-2" },
  { id: "s-3", category: "ร้านค้า", title: "เจ๊ดาวแกงปักษ์ใต้ รสเด็ด", subtitle: "ว่าง 50 กล่อง/วัน (ขาดทุนหมุนเวียน ฿15,500)", targetPage: "shop-finance", targetShopId: "shop-3" },
  { id: "s-4", category: "ร้านค้า", title: "เฮียฮงหมูกรอบเตาถ่าน", subtitle: "ว่าง 50 กล่อง/วัน (พร้อมรับงาน)", targetPage: "shop-finance", targetShopId: "shop-4" },
  { id: "s-5", category: "ร้านค้า", title: "ครัวสวนผักออร์แกนิค คลีนฟู้ด", subtitle: "ว่าง 50 กล่อง/วัน (พร้อมรับงาน)", targetPage: "shop-finance", targetShopId: "shop-5" },
  { id: "s-6", category: "ร้านค้า", title: "ปิ่นโตแม่เพ็ญ ครัวคุณย่า", subtitle: "ว่าง 50 กล่อง/วัน (พร้อมรับงาน)", targetPage: "shop-finance", targetShopId: "shop-6" },

  // Resources
  { id: "r-1", category: "ทรัพยากร", title: "ครัวว่าง / ครัวกลาง GMP ดินแดง", subtitle: "ว่างรอบเช้า 05:00–11:00 น. รองรับ 300–500 กล่อง", targetPage: "unlock" },
  { id: "r-2", category: "ทรัพยากร", title: "รถเย็นขนส่งร่วม Chilled Van", subtitle: "บรรทุก 400 กล่อง/เที่ยว แชร์ร่วม 6 ร้าน", targetPage: "unlock" },
  { id: "r-3", category: "ทรัพยากร", title: "เครื่องซีลถาดอาหารสูญญากาศ", subtitle: "ซีล 800 กล่อง/ชม. บางซื่อ", targetPage: "unlock" },

  // Funding
  { id: "f-1", category: "แหล่งทุน", title: "Invoice Factoring เปลี่ยน PO เป็นเงินสด", subtitle: "อนุมัติใน 24 ชม. ดอกเบี้ย 8.5% วงเงินสูงสุด 50,000 ฿", targetPage: "funding" },
  { id: "f-2", category: "แหล่งทุน", title: "SME Soft Loan ดอกเบี้ย 4.5%", subtitle: "สินเชื่อระยะยาว 12 เดือน ธพว.", targetPage: "funding" },
  { id: "f-3", category: "แหล่งทุน", title: "Crowd SME Bond กองทุนหุ้นกู้โครงการ", subtitle: "ระดมทุนใน 48 ชม. ดอกเบี้ย 7.2%", targetPage: "funding" },
];

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setCurrentPage } = useAppStore();
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

  const filtered = query.trim()
    ? searchableDatabase.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : searchableDatabase.slice(0, 8);

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
