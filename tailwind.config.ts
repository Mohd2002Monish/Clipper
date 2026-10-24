import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#E3F2FD',             // Base background
          main: '#90CAF9',           // Main light blue accent / borders
          secondary: '#2196F3',      // Secondary / primary action blue
          'secondary-hover': '#1E88E5',
          heading: '#0D47A1',        // Headings and important text
          surface: '#FFFFFF',        // Card surfaces
          subtle: '#F0F7FF',         // Soft inset surfaces
          muted: '#546E7A',          // Muted text
        },
        background: '#E3F2FD',
        surface: '#FFFFFF',
        'surface-elevated': '#F4F9FD',
        border: '#90CAF9',
        primary: {
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          500: '#2196F3',
          600: '#1E88E5',
          700: '#1976D2',
          900: '#0D47A1',
        },
        accent: {
          cyan: '#0288D1',
          violet: '#7C3AED',
          amber: '#F59E0B',
          emerald: '#10B981',
          rose: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'brand-card': '0 4px 20px -2px rgba(13, 71, 161, 0.08), 0 2px 6px -1px rgba(13, 71, 161, 0.04)',
        'brand-card-hover': '0 10px 25px -4px rgba(13, 71, 161, 0.12), 0 4px 10px -2px rgba(13, 71, 161, 0.06)',
        'brand-button': '0 4px 14px 0 rgba(33, 150, 243, 0.35)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
