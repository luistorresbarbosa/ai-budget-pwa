import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'aurora':
          'radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 45%), radial-gradient(circle at bottom right, rgba(236,72,153,0.12), transparent 50%)'
      },
      boxShadow: {
        glow: '0 20px 45px -25px rgba(56, 189, 248, 0.45)'
      }
    }
  },
  plugins: [forms]
};

export default config;
