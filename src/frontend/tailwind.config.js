import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
        electricBlue: "#00d9ff",
        neonGreen: "#39ff14",
        danger: "#ff4444",
        tradingBg: "#0b0f14",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        glass: "0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset",
        "glass-blue": "0 0 20px rgba(0,217,255,0.15), 0 4px 24px rgba(0,0,0,0.4)",
        "glass-green": "0 0 20px rgba(57,255,20,0.12), 0 4px 24px rgba(0,0,0,0.4)",
        glow: "0 0 12px rgba(0,217,255,0.4)",
        "glow-green": "0 0 12px rgba(57,255,20,0.35)",
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
        "pulse-green": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(57,255,20,0.6)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 0 6px rgba(57,255,20,0)" },
        },
        "pulse-red": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(255,68,68,0.6)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 0 6px rgba(255,68,68,0)" },
        },
        "pulse-blue": {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(0,217,255,0.5)" },
          "50%": { opacity: "0.8", boxShadow: "0 0 0 5px rgba(0,217,255,0)" },
        },
        "price-flash": {
          "0%": { backgroundColor: "rgba(0,217,255,0.2)" },
          "100%": { backgroundColor: "transparent" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-green": "pulse-green 2s ease-in-out infinite",
        "pulse-red": "pulse-red 2s ease-in-out infinite",
        "pulse-blue": "pulse-blue 1.5s ease-in-out infinite",
        "price-flash": "price-flash 0.8s ease-out",
        "fade-in-up": "fade-in-up 0.3s ease-out",
        "pulse-live": "pulse-live 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
