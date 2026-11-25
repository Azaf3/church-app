import { useNavigate } from 'react-router-dom'
import { useSessao } from '../lib/sessao'
import type { Papel } from '../lib/tipos'

const PAPEIS: [Papel, string][] = [
  ['admin', 'Administrador'], ['pastor', 'Pastor'], ['tesoureiro', 'Tesoureiro'], ['obreiro', 'Obreiro'], ['secretario', 'Secretário(a)'], ['membro', 'Membro'],
]

// Só existe na demonstração: deixa ver o app como cada cargo vê.
export default function FaixaDemo() {
  const { papel, recarregarEquipe } = useSessao()
  const ir = useNavigate()
  if (import.meta.env.MODE !== 'demo') return null
  const verComo = (globalThis as any).__demoVerComo as ((p: Papel) => void) | undefined
  if ('__SEED_PESSOAS__' in globalThis || !verComo) {
    return <div className="faixa-demo">Prévia particular · membros reais, mudanças não são salvas</div>
  }
  return (
    <div className="faixa-demo">
      Demonstração · ver como{' '}
      <select
        value={papel}
        onChange={async (e) => { verComo(e.target.value as Papel); await recarregarEquipe(); ir('/') }}
      >
        {PAPEIS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </div>
  )
}
