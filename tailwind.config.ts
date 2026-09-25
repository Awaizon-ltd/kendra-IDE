import type { Config } from 'tailwindcss';

// Same palette as awarizon.com so Kendra reads as part of the family.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#000000',
        panel: '#0A0A0A',
        'panel-2': '#111111',
        'panel-3': '#1A1A1A',
        line: '#222222',
        'line-bright': '#333333',
        accent: '#C8F13F',
        'accent-dim': '#8CA92C',
        muted: '#D4D4D4',
        dim: '#A0A0A0',
        read: '#60A5FA',
        write: '#F59E0B',
        pay: '#F472B6',
        ok: '#4ADE80',
        bad: '#F87171',
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
