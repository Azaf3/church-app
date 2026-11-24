// Tema por igreja: a partir de uma cor, gera os tons usados no app inteiro.

type RGB = [number, number, number]

const hexParaRgb = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbParaHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

// mistura a cor com outra (0 = só a cor, 1 = só a outra)
const misturar = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

const luminancia = ([r, g, b]: RGB) => {
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

import { APP_COR } from '../config'

export const COR_PADRAO = APP_COR

// versão mais viva e clara da cor (para marcas, barras e detalhes)
function vivo([r, g, b]: RGB): RGB {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255
  let h = 0, s = 0
  const l = (max + min) / 2, d = max - min
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    const [rr, gg, bb] = [r / 255, g / 255, b / 255]
    h = max === rr ? ((gg - bb) / d) % 6 : max === gg ? (bb - rr) / d + 2 : (rr - gg) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  const L = 0.46, S = Math.max(s, 0.42)
  const c = (1 - Math.abs(2 * L - 1)) * S, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - c / 2
  const [a, bq, cq] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(a + m) * 255, (bq + m) * 255, (cq + m) * 255]
}

export function tonsDaCor(cor: string) {
  let base = hexParaRgb(/^#[0-9a-f]{6}$/i.test(cor) ? cor : COR_PADRAO)
  // cor muito clara não dá contraste com texto branco: escurece até dar
  while (luminancia(base) > 0.18) base = misturar(base, [0, 0, 0], 0.08)
  const branco: RGB = [255, 255, 255]
  return {
    cor: rgbParaHex(base),
    escura: rgbParaHex(misturar(base, [0, 0, 0], 0.35)),
    clara: rgbParaHex(misturar(base, branco, 0.88)),
    media: rgbParaHex(misturar(base, branco, 0.55)),
    fundo: rgbParaHex(misturar(base, [247, 245, 241], 0.95)),
    destaque: rgbParaHex(vivo(base)),
  }
}

export function aplicarTema(cor: string) {
  const t = tonsDaCor(cor)
  const r = document.documentElement.style
  r.setProperty('--verde', t.cor)
  r.setProperty('--verde-escuro', t.escura)
  r.setProperty('--verde-claro', t.clara)
  r.setProperty('--verde-medio', t.media)
  r.setProperty('--fundo', t.fundo)
  r.setProperty('--destaque', t.destaque)
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.fundo)
}

// reduz a imagem do logo pra no máximo 256px e devolve como data URL leve
export async function prepararLogo(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url
    })
    const lado = 256
    const escala = Math.min(1, lado / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const webp = c.toDataURL('image/webp', 0.9)
    return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}

// tenta achar a cor dominante do logo (ignora branco, preto e cinza)
export async function corDoLogo(dataUrl: string): Promise<string | null> {
  const img = await new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = dataUrl })
  const c = document.createElement('canvas'); c.width = 48; c.height = 48
  const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0, 48, 48)
  const d = ctx.getImageData(0, 0, 48, 48).data
  const baldes = new Map<string, { n: number; s: RGB }>()
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b, a] = [d[i], d[i + 1], d[i + 2], d[i + 3]]
    if (a < 200) continue
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    if (max - min < 40 || max < 40) continue // cinza, branco ou preto
    const k = `${r >> 5}-${g >> 5}-${b >> 5}`
    const v = baldes.get(k) ?? { n: 0, s: [0, 0, 0] }
    v.n++; v.s = [v.s[0] + r, v.s[1] + g, v.s[2] + b]; baldes.set(k, v)
  }
  const melhor = [...baldes.values()].sort((a, b) => b.n - a.n)[0]
  if (!melhor) return null
  return rgbParaHex([melhor.s[0] / melhor.n, melhor.s[1] / melhor.n, melhor.s[2] / melhor.n])
}
