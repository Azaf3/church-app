import { Link } from 'react-router-dom'
import { useSessao } from '../lib/sessao'
import { PAPEIS, podeEquipe, podeFinanceiro } from '../lib/util'
import Icone from '../componentes/Icone'

export default function Mais() {
  const { papel, igrejas, igreja, trocarIgreja, sair, session } = useSessao()

  const itens = [
    { para: '/presenca', nome: 'Presença no culto', icone: 'presenca' },
    ...(podeFinanceiro(papel) ? [{ para: '/financeiro', nome: 'Dízimos e ofertas', icone: 'dinheiro' }] : []),
    { para: '/aniversariantes', nome: 'Aniversariantes', icone: 'bolo' },
    { para: '/equipe', nome: 'Equipe', icone: 'equipe' },
    ...(podeEquipe(papel) ? [{ para: '/importar', nome: 'Importar fichas (Google Forms)', icone: 'importar' }] : []),
  ]

  return (
    <>
      <h1 className="titulo">Mais</h1>
      <ul className="lista">
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
        <span>{session?.user.email}{papel && ` · ${PAPEIS[papel]}`}</span>
        <button className="btn" onClick={sair}><Icone nome="sair" tam={18} /> Sair</button>
      </div>
    </>
  )
}
