// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:       { DEFAULT: "var(--ink)", raised: "var(--ink-raised)", sunken: "var(--ink-sunken)" },
        rule:      { DEFAULT: "var(--rule)", strong: "var(--rule-strong)" },
        bone:      { DEFAULT: "var(--bone)", dim: "var(--bone-dim)", faint: "var(--bone-faint)" },
        brass:     { DEFAULT: "var(--brass)", dim: "var(--brass-dim)", wash: "var(--brass-wash)" },
        verdigris: "var(--verdigris)",
        rust:      "var(--rust)",
        amber:     "var(--amber)",
        focus:     "var(--focus)",
      },
      fontFamily: {
        display: ["Spectral", "Georgia", "serif"],
        sans:    ["Archivo", "system-ui", "sans-serif"],
        mono:    ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": ["76px", { lineHeight: "0.95", letterSpacing: "-0.02em"  }],
        "display-l":  ["48px", { lineHeight: "1.02", letterSpacing: "-0.015em" }],
        "display-m":  ["32px", { lineHeight: "1.12", letterSpacing: "-0.01em"  }],
        title:        ["20px", { lineHeight: "1.30", letterSpacing: "-0.005em" }],
        subtitle:     ["16px", { lineHeight: "1.40" }],
        body:         ["15px", { lineHeight: "1.55" }],
        prose:        ["17px", { lineHeight: "1.68" }],
        data:         ["14px", { lineHeight: "1.40" }],
        "data-sm":    ["12.5px", { lineHeight: "1.30" }],
        label:        ["12px", { lineHeight: "1.20", letterSpacing: "0.01em" }],
        micro:        ["11px", { lineHeight: "1.20", letterSpacing: "0.01em" }],
      },
      borderRadius: { none: "0", control: "2px", soft: "10px" },
      maxWidth: { container: "1440px", prose: "68ch" },
      transitionTimingFunction: { swell: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
} satisfies Config;
