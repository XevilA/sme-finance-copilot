/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ivory: '#FAF7F0',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#14224A',
          muted: '#5B678A',
          light: '#8E9BB5',
        },
        navy: {
          deep: '#0A1230',
          surface: '#121C3E',
          card: '#18244D',
          border: '#233266',
        },
        brand: {
          DEFAULT: '#6C4CF1',
          glow: '#9B82FF',
          dark: '#5436D6',
          light: '#F0ECFE',
        },
        resource: {
          DEFAULT: '#16C1B0',
          dark: '#0FA293',
          light: '#E6FAF8',
          glow: '#4FE7D8',
        },
        attention: {
          DEFAULT: '#F59A23',
          dark: '#D97E0E',
          light: '#FEF5E9',
        },
        danger: {
          DEFAULT: '#E5484D',
          dark: '#C73338',
          light: '#FDECEE',
        },
        borderLine: '#E6E1D5',
      },
      borderRadius: {
        'card': '20px',
        'btn': '14px',
        'chip': '999px',
      },
      boxShadow: {
        'soft-sm': '0 1px 2px rgba(20, 34, 74, 0.05)',
        'soft-md': '0 8px 24px -8px rgba(20, 34, 74, 0.12)',
        'soft-lg': '0 24px 60px -20px rgba(20, 34, 74, 0.18)',
        'glow-primary': '0 0 25px -4px rgba(108, 76, 241, 0.45)',
        'glow-resource': '0 0 25px -4px rgba(22, 193, 176, 0.45)',
        'glow-danger': '0 0 25px -4px rgba(229, 72, 77, 0.45)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'Prompt', 'sans-serif'],
        display: ['Prompt', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
