import { create } from "zustand";

export type NavPage =
  | "overview"
  | "import"
  | "cashflow"
  | "health"
  | "cost"
  | "sales"
  | "funding"
  | "swarm"
  | "shop-finance"
  | "unlock"
  | "funder"
  | "simulator"
  | "projects"
  | "reports";

export type UserRole = "owner" | "buyer" | "funder";

export type MotionIntensity = "full" | "reduced" | "off";

export type PageStateMode =
  | "normal"
  | "empty"
  | "loading"
  | "insufficient_data"
  | "error"
  | "not_found"
  | "no_permission"
  | "stale"
  | "success"
  | "unsaved";

export type ToastMessage = {
  id: string;
  type: "success" | "warning" | "error" | "info";
  title: string;
  message: string;
  duration?: number;
};

interface AppState {
  // Navigation & Role
  currentPage: NavPage;
  userRole: UserRole;
  setCurrentPage: (page: NavPage, context?: { shopId?: string; orderId?: string }) => void;
  setUserRole: (role: UserRole) => void;

  // Cross-Page Context
  selectedShopId: string;
  selectedOrderId: string;
  contextPill: string | null;
  setSelectedShopId: (shopId: string) => void;
  setSelectedOrderId: (orderId: string) => void;
  setContextPill: (pill: string | null) => void;

  // Motion Settings
  motionIntensity: MotionIntensity;
  isReducedMotion: boolean;
  setMotionIntensity: (intensity: MotionIntensity) => void;
  toggleReducedMotion: () => void;

  // Simulation Sandbox
  isSimulating: boolean;
  simulatedDepositPercent: number;
  simulatedPaymentTermsDays: number;
  simulatedFactoringActive: boolean;
  detachedResourceIds: string[];
  swappedShops: Record<string, string>;
  hasUnsavedChanges: boolean;
  setSimulatedDeposit: (percent: number) => void;
  setSimulatedPaymentTerms: (days: number) => void;
  setSimulatedFactoring: (active: boolean) => void;
  toggleDetachResource: (resourceId: string) => void;
  swapShop: (oldId: string, newId: string) => void;
  resetSimulation: () => void;
  saveSimulationPlan: (name: string) => void;

  // Command Palette & Modals
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // AI Panel & Evidence Beam
  isAIPanelOpen: boolean;
  activeEvidenceTargetId: string | null;
  setAIPanelOpen: (open: boolean) => void;
  setActiveEvidenceTarget: (targetId: string | null) => void;

  // Story Mode (E5)
  isStoryModeOpen: boolean;
  storyCurrentScene: number; // 1 to 6
  setStoryModeOpen: (open: boolean) => void;
  setStoryScene: (scene: number) => void;
  nextStoryScene: () => void;
  prevStoryScene: () => void;

  // 9-State Showcase Controller (Part H)
  pageStateMode: PageStateMode;
  setPageStateMode: (mode: PageStateMode) => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation & Role
  currentPage: "overview",
  userRole: "owner",
  setCurrentPage: (page, context) => {
    set((state) => ({
      currentPage: page,
      isMobileMenuOpen: false,
      selectedShopId: context?.shopId || state.selectedShopId,
      selectedOrderId: context?.orderId || state.selectedOrderId,
      contextPill: context?.shopId
        ? `ร้านที่เลือก: ${context.shopId === "shop-1" ? "ร้านบ้านข้าวหอม (ขาด ฿14,000)" : context.shopId}`
        : null,
    }));
  },
  setUserRole: (role) => set({ userRole: role }),

  // Cross-Page Context
  selectedShopId: "shop-1",
  selectedOrderId: "order-catering-300",
  contextPill: null,
  setSelectedShopId: (shopId) => set({ selectedShopId: shopId }),
  setSelectedOrderId: (orderId) => set({ selectedOrderId: orderId }),
  setContextPill: (pill) => set({ contextPill: pill }),

  // Motion Settings
  motionIntensity: "full",
  isReducedMotion: false,
  setMotionIntensity: (intensity) =>
    set({
      motionIntensity: intensity,
      isReducedMotion: intensity === "off" || intensity === "reduced",
    }),
  toggleReducedMotion: () =>
    set((state) => ({
      isReducedMotion: !state.isReducedMotion,
      motionIntensity: !state.isReducedMotion ? "reduced" : "full",
    })),

  // Simulation Sandbox
  isSimulating: false,
  simulatedDepositPercent: 20,
  simulatedPaymentTermsDays: 15,
  simulatedFactoringActive: false,
  detachedResourceIds: [],
  swappedShops: {},
  hasUnsavedChanges: false,
  setSimulatedDeposit: (percent) =>
    set({
      simulatedDepositPercent: percent,
      isSimulating: true,
      hasUnsavedChanges: true,
    }),
  setSimulatedPaymentTerms: (days) =>
    set({
      simulatedPaymentTermsDays: days,
      isSimulating: true,
      hasUnsavedChanges: true,
    }),
  setSimulatedFactoring: (active) =>
    set({
      simulatedFactoringActive: active,
      isSimulating: true,
      hasUnsavedChanges: true,
    }),
  toggleDetachResource: (resourceId) =>
    set((state) => {
      const exists = state.detachedResourceIds.includes(resourceId);
      const updated = exists
        ? state.detachedResourceIds.filter((id) => id !== resourceId)
        : [...state.detachedResourceIds, resourceId];
      return {
        detachedResourceIds: updated,
        isSimulating: true,
        hasUnsavedChanges: true,
      };
    }),
  swapShop: (oldId, newId) =>
    set((state) => ({
      swappedShops: { ...state.swappedShops, [oldId]: newId },
      isSimulating: true,
      hasUnsavedChanges: true,
    })),
  resetSimulation: () =>
    set({
      isSimulating: false,
      simulatedDepositPercent: 20,
      simulatedPaymentTermsDays: 15,
      simulatedFactoringActive: false,
      detachedResourceIds: [],
      swappedShops: {},
      hasUnsavedChanges: false,
    }),
  saveSimulationPlan: (name) => {
    const { addToast } = get();
    set({ hasUnsavedChanges: false });
    addToast({
      type: "success",
      title: "บันทึกแผนจำลองสำเร็จ",
      message: `สร้างแผนฉบับใหม่ '${name}' และส่งเข้าคิวรอตรวจยอมรับแล้ว`,
    });
  },

  // Command Palette & Modals
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),

  // AI Panel & Evidence Beam
  isAIPanelOpen: false,
  activeEvidenceTargetId: null,
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  setActiveEvidenceTarget: (targetId) => set({ activeEvidenceTargetId: targetId }),

  // Story Mode (E5)
  isStoryModeOpen: false,
  storyCurrentScene: 1,
  setStoryModeOpen: (open) => set({ isStoryModeOpen: open, storyCurrentScene: 1 }),
  setStoryScene: (scene) => set({ storyCurrentScene: Math.max(1, Math.min(6, scene)) }),
  nextStoryScene: () =>
    set((state) => ({ storyCurrentScene: Math.min(6, state.storyCurrentScene + 1) })),
  prevStoryScene: () =>
    set((state) => ({ storyCurrentScene: Math.max(1, state.storyCurrentScene - 1) })),

  // 9-State Showcase Controller (Part H)
  pageStateMode: "normal",
  setPageStateMode: (mode) => set({ pageStateMode: mode }),

  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = "toast-" + Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, toast.duration || 4500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
