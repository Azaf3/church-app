import type { Igreja } from '../lib/tipos'

export default function LogoIgreja({ igreja, tam = 32 }: { igreja: Igreja | null; tam?: number }) {
  const estilo = { width: tam, height: tam, fontSize: tam * 0.45 }
  if (igreja?.logo) return <img className="logo-igreja" src={igreja.logo} alt="" style={estilo} />
  return <span className="logo-igreja vazio" style={estilo}>{igreja?.nome.trim().charAt(0) ?? '·'}</span>
}
