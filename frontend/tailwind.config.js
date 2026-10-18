const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: c('paper'), surface: c('surface'), ink: c('ink'), mute: c('mute'),
        line: c('line'), accent: c('accent'), 'accent-ink': c('accent-ink'), mark: c('mark'),
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      borderRadius: { card: '14px' },
    },
  },
  plugins: [],
};
