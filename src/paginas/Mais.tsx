import { Link } from 'react-router-dom'
import { useSessao } from '../lib/sessao'
import { PAPEIS, podeEquipe, podeFinanceiro, podePedidos, podeSecretaria, rotuloCargo } from '../lib/util'
import Icone from '../componentes/Icone'

export default function Mais() {
  const { papel, igrejas, igreja, trocarIgreja, sair, session, equipe, userId } = useSessao()
  const eu = equipe.find((e) => e.user_id === userId)

  const itens = [
    ...(podePedidos(papel) ? [{ para: '/pedidos', nome: 'Pedidos de oração e visita', icone: 'coracao' }] : []),
    ...(podeSecretaria(papel) ? [{ para: '/secretaria', nome: 'Secretaria', icone: 'pasta' }] : []),
    ...(podeFinanceiro(papel) ? [{ para: '/financeiro', nome: 'Tesouraria', icone: 'dinheiro' }, { para: '/sete', nome: 'Seminário SETE', icone: 'livro' }] : []),
    { para: '/aniversariantes', nome: 'Aniversariantes', icone: 'bolo' },
    { para: '/relatorios', nome: 'Relatórios do mês', icone: 'grafico' },
    { para: '/equipe', nome: 'Equipe', icone: 'equipe' },
    ...(podeEquipe(papel) ? [
      { para: '/importar', nome: 'Importar fichas (Google Forms)', icone: 'importar' },
      { para: '/configuracoes', nome: 'Configurações da igreja', icone: 'engrenagem' },
    ] : []),
  ]

  return (
    <>
      <h1 className="titulo">Mais</h1>
      <ul className="lista agrupada">
        {itens.map((i) => (
          <li key={i.para}>
            <Link to={i.para} className="item">
              <span className="icone-item"><Icone nome={i.icone} /></span>
              <div className="item-texto"><strong>{i.nome}</strong></div>
              <Icone nome="seta" tam={18} />
            </Link>
          </li>
        ))}
      </ul>

      {igrejas.length > 1 && (
        <label className="form">Igreja
          <select value={igreja?.id} onChange={(e) => trocarIgreja(e.target.value)}>
            {igrejas.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select>
        </label>
      )}

      <div className="conta">
        <span>{session?.user.email}{eu ? ` · ${rotuloCargo(eu)}` : papel && ` · ${PAPEIS[papel]}`}</span>
        <button className="btn" onClick={sair}><Icone nome="sair" tam={18} /> Sair</button>
      </div>
    </>
  )
}
