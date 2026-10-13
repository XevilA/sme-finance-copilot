// ==========================================
// SME Finance Copilot — Motion System Tokens
// ==========================================

export const motionTokens = {
  dur: {
    micro: 0.12,
    fast: 0.2,
    base: 0.32,
    slow: 0.55,
    hero: 1.2,
  },
  ease: {
    out: [0.16, 1, 0.3, 1] as const,     // Entrance / Open
    inOut: [0.65, 0, 0.35, 1] as const,  // Position shifts
    sharp: [0.4, 0, 0.2, 1] as const,    // Snappy transitions
  },
  spring: {
    snap: { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.8 }, // Card snap
    soft: { type: "spring" as const, stiffness: 220, damping: 26 },           // Drawer slide
    pop: { type: "spring" as const, stiffness: 700, damping: 18 },            // Pin bounce
  },
  stagger: {
    tight: 0.04,
    base: 0.07,
    wide: 0.12,
  },
};
