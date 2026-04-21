import type { Config } from "tailwindcss";

/**
 * JengaTrack Design System — "Industrial Precision meets African Warmth"
 *
 * Dark-mode first with rich earthy accent tones (burnt orange, golden amber,
 * deep terracotta) paired with the cold precision of a Figma/Linear dashboard.
 */
export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "380px",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "12px",
        modal: "16px",
        btn: "8px",
      },
      spacing: {
        "sidebar": "var(--sidebar-width)",
        "sidebar-collapsed": "var(--sidebar-collapsed)",
        "sidebar-open": "260px",
        "sidebar-closed": "72px",
        "topbar": "64px",
      },
      colors: {
        // ─── JengaTrack Brand Palette ─────────────────────────────────────
        jenga: {
          bg: "var(--jt-background)",
          surface: "var(--jt-surface)",
          raised: "var(--jt-surface-raised)",
          border: "var(--jt-border)",
          "border-strong": "var(--jt-border-strong)",
          text: "var(--jt-text-primary)",
          "text-muted": "var(--jt-text-secondary)",
          "text-hint": "var(--jt-text-tertiary)",
          primary: "var(--jt-accent-primary)",
          "primary-hover": "var(--jt-accent-primary-hover, #F08B49)",
          secondary: "var(--jt-accent-secondary)",
          gold: "var(--jt-accent-secondary)",
          terracotta: "var(--jt-accent-terracotta, #9B4B2E)",
          success: "var(--jt-accent-success)",
          warning: "var(--jt-accent-warning)",
          danger: "var(--jt-accent-danger)",
          info: "var(--jt-accent-info)",
          whatsapp: "var(--jt-accent-whatsapp, #25D366)",
          sidebar: "var(--jt-sidebar-bg)",
        },

        // Legacy brand palette kept for backward compatibility
        "fresh-fern": "#93C54E",
        "ocean-pine": "#218598",
        graphite: "#2F3332",
        "ash-gray": "#E2E8F0",
        "alert-red": "#D95F5F",
        "warning-yellow": "#E0A030",
        "success-green": "#4CAF7D",
        "moss-green": "#B4D68C",
        "aqua-breeze": "#6EC1C0",
        "brand-primary-start": "#E07B39",
        "brand-primary-end": "#C9A84C",

        // Shadcn tokens (wired to JT palette)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        "jenga-gradient":
          "linear-gradient(135deg, #E07B39 0%, #C9A84C 100%)",
        "jenga-gradient-subtle":
          "linear-gradient(135deg, rgba(224,123,57,0.14) 0%, rgba(201,168,76,0.10) 100%)",
        "jenga-radial":
          "radial-gradient(ellipse at top, rgba(224,123,57,0.12), transparent 60%)",
        "brand-gradient":
          "linear-gradient(135deg, #E07B39 0%, #C9A84C 100%)",
        "brand-gradient-dark":
          "linear-gradient(135deg, #141714 0%, #0D0F0E 100%)",
        "brand-gradient-light":
          "linear-gradient(135deg, #FFFFFF 0%, #F0EDE6 100%)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["Syne", "system-ui", "sans-serif"],
        heading: ["Syne", "League Spartan", "system-ui", "sans-serif"],
        body: ["DM Sans", "Nunito Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
        "card-hover":
          "0 2px 6px rgba(0,0,0,0.45), 0 8px 32px rgba(0,0,0,0.28)",
        modal: "0 8px 48px rgba(0,0,0,0.6)",
        "focus-ring": "0 0 0 2px rgba(224,123,57,0.4)",
        "inner-line": "inset 0 1px 0 rgba(255,255,255,0.03)",
        glow: "0 0 24px rgba(224,123,57,0.25)",
        "glow-gold": "0 0 20px rgba(201,168,76,0.25)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-border": {
          "0%, 100%": { borderColor: "rgba(224,160,48,0.6)" },
          "50%": { borderColor: "rgba(224,160,48,0.15)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        "pulse-border": "pulse-border 2s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.35s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
