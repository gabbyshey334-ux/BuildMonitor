/**
 * Design tokens extracted from JengaTrack landing page.
 * Use these for the entire navigation system for consistency.
 */
export const navTokens = {
  // Primary (landing CTA, active states)
  primary: "#22c55e",
  primaryTeal: "#14b8a6",
  primaryGradient: "linear-gradient(to right, #22c55e, #14b8a6)",
  primaryGradientClass: "bg-gradient-to-r from-[#22c55e] to-[#14b8a6]",

  // Backgrounds (nav, sidebar, bottom bar)
  bgDark: "#0a0a0a",
  bgDark95: "rgba(10, 10, 10, 0.95)",
  bgZinc900: "#18181b",
  bgZinc800: "#27272a",

  // Text
  textWhite: "#ffffff",
  textZinc300: "#d4d4d8",
  textZinc400: "#a1a1aa",
  textZinc500: "#71717a",

  // Borders
  borderZinc800: "rgba(39, 39, 42, 0.5)",
  borderZinc800Class: "border-zinc-800/50",

  // Hover / active
  hoverBg: "rgba(255, 255, 255, 0.05)",
  hoverBgZinc: "rgba(39, 39, 42, 0.5)",
  activeBg: "rgba(34, 197, 94, 0.15)",

  // Sidebar dimensions
  sidebarOpenWidth: 240,
  sidebarCollapsedWidth: 64,

  // Transitions
  transitionFast: "transition-all duration-200 ease-out",
  transitionNormal: "transition-all duration-300 ease-out",
} as const;
