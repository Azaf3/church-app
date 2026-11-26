import { useEffect } from 'react'

// Fundo que se mexe devagar (ondas, um brilho que passeia e luzinhas subindo).
// Só CSS animando transform: o navegador joga pra placa de vídeo, sem custo de JavaScript.
// "login" é o cheio; "app" é bem mais apagado, atrás do sistema. Pausa quando a aba fica escondida.
const ONDA = 'M0 200C240 120 480 120 720 200S1200 280 1440 200S1920 120 2160 200S2640 280 2880 200'

function Onda({ cls, preenche, traco }: { cls: string; preenche?: string; traco: string }) {
  return (
    <svg className={'fv-onda ' + cls} viewBox="0 0 2880 400" preserveAspectRatio="none" aria-hidden="true">
      {preenche && <path d={ONDA + 'V400H0Z'} fill={preenche} />}
      <path d={ONDA} fill="none" stroke={traco} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function FundoVivo({ modo }: { modo: 'login' | 'app' }) {
  useEffect(() => {
    const f = () => document.body.classList.toggle('fv-pausa', document.hidden)
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])

  const luzes = modo === 'login' ? [1, 2, 3, 4, 5, 6, 7] : [1, 3, 4, 6]
  return (
    <div className={'fundo-vivo fv-' + modo} aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="fvDegrade1" x1="0" y1="0" x2="0" y2="1"><stop offset="0.4" stopColor="#3f9a52" stopOpacity=".16" /><stop offset="1" stopColor="#3f9a52" stopOpacity="0" /></linearGradient>
          <linearGradient id="fvDegrade2" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stopColor="#1f5c4c" stopOpacity=".14" /><stop offset="1" stopColor="#1f5c4c" stopOpacity="0" /></linearGradient>
        </defs>
      </svg>
      <div className="fv-brilho" />
      {modo === 'login' && (
        <div className="fv-faixa fv-cima">
          <Onda cls="o1" traco="rgba(63,154,82,.45)" />
          <Onda cls="o2" traco="rgba(196,160,72,.4)" />
        </div>
      )}
      <div className="fv-faixa fv-baixo">
        <Onda cls="o3" preenche="url(#fvDegrade1)" traco="rgba(63,154,82,.55)" />
        <Onda cls="o4" preenche="url(#fvDegrade2)" traco="rgba(31,92,76,.4)" />
        {modo === 'login' && <Onda cls="o5" traco="rgba(196,160,72,.45)" />}
      </div>
      {luzes.map((i) => <span key={i} className={'fv-luz l' + i} />)}
    </div>
  )
}
