/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens semânticos -> CSS variables (alternam entre tema dia/noite).
        fundo: "var(--fundo)",
        superficie: "var(--superficie)",
        cartao: "var(--cartao)",
        cartaoAlt: "var(--cartaoAlt)",
        borda: "var(--borda)",
        bordaForte: "var(--bordaForte)",
        texto: "var(--texto)",
        textoSec: "var(--textoSec)",
        textoTen: "var(--textoTen)",
        verde: "var(--verde)",
        verdeEsc: "var(--verdeEsc)",
        verdeTint: "var(--verdeTint)",
        verdeTexto: "var(--verdeTexto)",
        noVerde: "var(--noVerde)",
        vermelho: "var(--vermelho)",
        vermelhoTint: "var(--vermelhoTint)",
        ambar: "var(--ambar)",
        ambarTint: "var(--ambarTint)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};
