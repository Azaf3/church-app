// Ícones de traço simples (24x24), sem dependência externa
const caminhos: Record<string, string> = {
  hoje: 'M4 7h16M4 12h10M4 17h7',
  pessoas: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  jornada: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z',
  agenda: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5',
  mais: 'M5 12h.01M12 12h.01M19 12h.01',
  whats: 'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z',
  mais_um: 'M12 5v14M5 12h14',
  voltar: 'M15 18l-6-6 6-6',
  check: 'M5 12l5 5 9-10',
  seta: 'M9 6l6 6-6 6',
  telefone: 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  bolo: 'M4 21h16M5 21v-7h14v7M12 14V9M12 6.5a1.5 1.5 0 0 0 0-3c0 1-1 1.5 0 3z',
  presenca: 'M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10',
  dinheiro: 'M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  equipe: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  sair: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  importar: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  grafico: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  engrenagem: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  calendario_mais: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5M12 13v5M9.5 15.5h5',
  livro: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h8',
  fechar: 'M6 6l12 12M18 6L6 18',
}

export default function Icone({ nome, tam = 22 }: { nome: keyof typeof caminhos | string; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={caminhos[nome] ?? ''} />
    </svg>
  )
}
