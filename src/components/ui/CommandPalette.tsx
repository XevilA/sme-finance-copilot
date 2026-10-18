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
  category: "Shops" | "Projects" | "Resources" | "Funders" | "Menu";
  title: string;
  subtitle: string;
  targetPage: NavPage;
  targetShopId?: string;
};

const searchableMenu: SearchResultItem[] = [
  // Menu items
  { id: "m-1", category: "Menu", title: "Business Overview", subtitle: "Review revenue, profit, cash, and recommended next steps", targetPage: "overview" },
  { id: "m-2", category: "Menu", title: "Business Data & Import", subtitle: "Upload Excel or enter financial data across 8 categories", targetPage: "import" },
  { id: "m-3", category: "Menu", title: "Cash & Cash Flow (Time Travel)", subtitle: "Explore your business cash position 30–90 days ahead", targetPage: "cashflow" },
  { id: "m-4", category: "Menu", title: "Financial Health", subtitle: "Analyze liquidity, profit, debt, and efficiency", targetPage: "health" },
  { id: "m-5", category: "Menu", title: "Costs & Profitability", subtitle: "Unit costs, break-even point, and Plan A/B investment", targetPage: "cost" },
  { id: "m-6", category: "Menu", title: "Sales & Products", subtitle: "Sales and profit by product and channel", targetPage: "sales" },
  { id: "m-7", category: "Menu", title: "Funding Match", subtitle: "Find funding options and estimate repayments", targetPage: "funding" },
  { id: "m-8", category: "Menu", title: "SME SWARM Team Assembly", subtitle: "Assign orders using saved shop capacity and resources", targetPage: "swarm" },
  { id: "m-9", category: "Menu", title: "Per-SME Cash Plan", subtitle: "Review each shop's cash flow and approve its plan", targetPage: "shop-finance" },
  { id: "m-10", category: "Menu", title: "SME UNLOCK Resources", subtitle: "Share kitchens, delivery vehicles, machinery, and labor", targetPage: "unlock" },
  { id: "m-11", category: "Menu", title: "Funder Portal", subtitle: "Review saved projects and their evidence levels", targetPage: "funder" },
  { id: "m-12", category: "Menu", title: "Simulation & Chaos Rehearsal", subtitle: "Rehearse disruption scenarios across 4 phases", targetPage: "simulator" },
  { id: "m-13", category: "Menu", title: "Projects & Reports", subtitle: "Compare actual outcomes with the saved plan", targetPage: "projects" },

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
  const money = (value: number) => `฿${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const catalogue: SearchResultItem[] = [
    ...searchableMenu,
    ...(shopState.envelope?.data || []).map((shop) => ({
      id: `shop-${shop.id}`,
      category: "Shops" as const,
      title: shop.name,
      subtitle: `Available capacity: ${shop.capacityAvailable} ${shop.unit}`
        + (shop.fundingGap > 0 ? ` · Working-capital shortfall: ${money(shop.fundingGap)}` : " · No funding gap recorded")
        + ` · ${shop.location}`,
      targetPage: "shop-finance" as NavPage,
      targetShopId: shop.id,
    })),
    ...(resourceState.envelope?.data || []).map((resource) => ({
      id: `resource-${resource.id}`,
      category: "Resources" as const,
      title: resource.title,
      subtitle: `${resource.capacityText} · ${resource.priceText} · `
        + (resource.status === "confirmed" ? "Confirmed" : "Proposed"),
      targetPage: "unlock" as NavPage,
    })),
    ...(fundingState.envelope?.data || []).map((option) => ({
      id: `funding-${option.id}`,
      category: "Funders" as const,
      title: option.name,
      subtitle: `${option.typeLabel} · ${option.provider} · ${option.interestRateAnnual}% annual interest`
        + ` · Disbursed in ${option.disbursementDays} days`,
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
      case "Shops":
        return <Store className="w-4 h-4 text-brand" />;
      case "Projects":
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case "Resources":
        return <Wrench className="w-4 h-4 text-resource-dark" />;
      case "Funders":
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
            placeholder="Search shops, menus, available kitchens, funders, projects... (press Esc to close)"
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
              No results found for "{query}"
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
          <span>Press <strong>Enter</strong> to select</span>
          <span className="font-mono">Press ⌘K to open anytime</span>
        </div>
      </div>
    </div>
  );
};
