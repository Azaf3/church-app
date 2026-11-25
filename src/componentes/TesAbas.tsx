import { NavLink } from 'react-router-dom'

// navegação da tesouraria: caixa do mês, ano, relação e campanhas
export default function TesAbas() {
  const itens: [string, string][] = [
    ['/financeiro', 'Mês'],
    ['/financeiro/ano', 'Ano'],
    ['/financeiro/relacao', 'Dizimistas'],
    ['/financeiro/campanhas', 'Campanhas'],
  ]
  return (
    <nav className="tes-abas sem-impressao">
      {itens.map(([para, nome]) => (
        <NavLink key={para} to={para} end className={({ isActive }) => (isActive ? 'ativa' : '')}>{nome}</NavLink>
      ))}
    </nav>
  )
}
