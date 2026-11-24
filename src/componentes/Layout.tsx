import { NavLink, Outlet } from 'react-router-dom'
import { useSessao } from '../lib/sessao'
import { PAPEIS, podeEquipe, podeFinanceiro, primeiroNome } from '../lib/util'
import Icone from './Icone'
import LogoIgreja from './LogoIgreja'

// celular: 5 abas embaixo
const abas = [
  { para: '/', nome: 'Hoje', icone: 'hoje' },
  { para: '/pessoas', nome: 'Pessoas', icone: 'pessoas' },
  { para: '/jornada', nome: 'Jornada', icone: 'jornada' },
  { para: '/agenda', nome: 'Agenda', icone: 'agenda' },
  { para: '/mais', nome: 'Mais', icone: 'mais' },
]

export default function Layout() {
  const { igreja, papel, equipe, userId, sair } = useSessao()
  const eu = equipe.find((e) => e.user_id === userId)

  // computador: menu lateral completo
  const grupos = [
    { titulo: 'Cuidado', itens: [
      { para: '/', nome: 'Meu dia', icone: 'hoje' },
      { para: '/pessoas', nome: 'Pessoas', icone: 'pessoas' },
      { para: '/jornada', nome: 'Jornada', icone: 'jornada' },
      { para: '/agenda', nome: 'Agenda pastoral', icone: 'agenda' },
      { para: '/presenca', nome: 'Presença', icone: 'presenca' },
      { para: '/aniversariantes', nome: 'Aniversariantes', icone: 'bolo' },
    ] },
    { titulo: 'Gestão', itens: [
      ...(podeFinanceiro(papel) ? [{ para: '/financeiro', nome: 'Dízimos e ofertas', icone: 'dinheiro' }] : []),
      { para: '/relatorios', nome: 'Relatórios', icone: 'grafico' },
      { para: '/equipe', nome: 'Equipe', icone: 'equipe' },
      ...(podeEquipe(papel) ? [
        { para: '/importar', nome: 'Importar fichas', icone: 'importar' },
        { para: '/configuracoes', nome: 'Configurações', icone: 'engrenagem' },
      ] : []),
    ] },
  ]

  return (
    <div className="app">
      {import.meta.env.MODE === 'demo' && (
        <div className="faixa-demo">
          {'__SEED_PESSOAS__' in globalThis
            ? 'Prévia particular · membros reais, mudanças não são salvas'
            : 'Demonstração · dados de exemplo, nada é salvo'}
        </div>
      )}

      <aside className="lateral">
        <div className="lateral-igreja">
          <LogoIgreja igreja={igreja} tam={40} />
          <div>
            <strong>{igreja?.nome}</strong>
            {igreja?.cidade && <small>{igreja.cidade}</small>}
          </div>
        </div>
        <nav>
          {grupos.map((g) => (
            <div key={g.titulo} className="lateral-grupo">
              <span className="lateral-titulo">{g.titulo}</span>
              {g.itens.map((i) => (
                <NavLink key={i.para} to={i.para} end={i.para === '/'}
                  className={({ isActive }) => 'lateral-item' + (isActive ? ' ativo' : '')}>
                  <Icone nome={i.icone} tam={19} />
                  <span>{i.nome}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="lateral-conta">
          <span className="avatar pequeno">{eu ? primeiroNome(eu.nome).charAt(0) : '·'}</span>
          <div>
            <strong>{eu ? primeiroNome(eu.nome) : ''}</strong>
            <small>{papel ? PAPEIS[papel] : ''}</small>
          </div>
          <button className="btn-icone" onClick={sair} aria-label="Sair" title="Sair"><Icone nome="sair" tam={18} /></button>
        </div>
      </aside>

      <header className="topo">
        <LogoIgreja igreja={igreja} tam={28} />
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
