import { useEffect, type ReactNode } from 'react'
import Icone from './Icone'

// Painel que sobe de baixo (bom pra formulário no celular)
export default function Folha({ titulo, aberta, fechar, children }: {
  titulo: string; aberta: boolean; fechar: () => void; children: ReactNode
}) {
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [aberta, fechar])

  if (!aberta) return null
  return (
    <div className="folha-fundo" onClick={fechar}>
      <div className="folha" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="folha-topo">
          <h2>{titulo}</h2>
          <button className="btn-icone" onClick={fechar} aria-label="Fechar"><Icone nome="fechar" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
