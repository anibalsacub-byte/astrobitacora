export const INK = '#1d1b18'
export const SOFT = '#4a453d'
export const GOLD = '#a8843a'
export const NAVY = '#13203b'
export const PAPER = '#fbf7ee'
export const RULE = '#b9a477'
export const RETRO = '#8a3b3b'

export const SERIF = 'Cormorant Garamond, EB Garamond, Georgia, serif'
export const BODY = 'EB Garamond, Georgia, serif'
export const GLYPH = 'Segoe UI Symbol, Noto Sans Symbols 2, Noto Sans Symbols, DejaVu Sans, sans-serif'

export type Pt = [number, number]

/** Distribuye etiquetas en una cuadrícula centrada en (cx, cy). */
export function gridLayout(n: number, cx: number, cy: number, maxRows: number, colW: number, rowH: number): Pt[] {
  const cols = Math.max(1, Math.ceil(n / maxRows))
  const rows = Math.ceil(n / cols)
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    out.push([cx + (c - (cols - 1) / 2) * colW, cy + (r - (rows - 1) / 2) * rowH])
  }
  return out
}
