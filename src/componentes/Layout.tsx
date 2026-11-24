import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../lib/sessao'
import Icone from './Icone'

const abas = [
  { para: '/', nome: 'Hoje', icone: 'hoje' },
  { para: '/pessoas', nome: 'Pessoas', icone: 'pessoas' },
  { para: '/jornada', nome: 'Jornada', icone: 'jornada' },
  { para: '/agenda', nome: 'Agenda', icone: 'agenda' },
  { para: '/mais', nome: 'Mais', icone: 'mais' },
]

export default function Layout() {
  const { igreja } = useSessao()
  return (
    <div className="app">
      {import.meta.env.MODE === 'demo' && (
        <div className="faixa-demo">
          {'__SEED_PESSOAS__' in globalThis
            ? 'Prévia particular · membros reais, mudanças não são salvas'
            : 'Demonstração · dados de exemplo, nada é salvo'}
        </div>
      )}
      <header className="topo">
        <span className="topo-marca" />
        <strong>{igreja?.nome}</strong>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      <nav className="abas">
        {abas.map((a) => (
          <NavLink key={a.para} to={a.para} end={a.para === '/'}
            className={({ isActive }) => 'aba' + (isActive ? ' ativa' : '')}>
            <Icone nome={a.icone} />
            <span>{a.nome}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
