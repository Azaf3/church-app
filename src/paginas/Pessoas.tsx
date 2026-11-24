import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Pessoa } from '../lib/tipos'
import { iniciais } from '../lib/util'
import Folha from '../componentes/Folha'
import FormPessoa from '../componentes/FormPessoa'
import BotaoWhats from '../componentes/BotaoWhats'
import Icone from '../componentes/Icone'

type Filtro = 'todos' | 'membro' | 'visitante'

export default function Pessoas() {
  const { igreja } = useSessao()
  const navegar = useNavigate()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [params] = useSearchParams()
  const [novo, setNovo] = useState(params.get('novo') === '1')

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas(data ?? []))
  }, [igreja?.id])

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return pessoas.filter((p) =>
      (filtro === 'todos' || p.tipo === filtro) &&
      (!t || p.nome.toLowerCase().includes(t) || (p.telefone ?? '').includes(t)))
  }, [pessoas, busca, filtro])

  const contagem = (t: Filtro) => t === 'todos' ? pessoas.length : pessoas.filter((p) => p.tipo === t).length

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Pessoas</h1>
        <button className="btn btn-primario" onClick={() => setNovo(true)}><Icone nome="mais_um" tam={18} /> Cadastrar</button>
      </div>

      <input className="busca" type="search" placeholder="Buscar por nome ou telefone"
        value={busca} onChange={(e) => setBusca(e.target.value)} />

      <div className="seg">
        {(['todos', 'membro', 'visitante'] as Filtro[]).map((f) => (
          <button key={f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>
            {f === 'todos' ? 'Todos' : f === 'membro' ? 'Membros' : 'Visitantes'} <small>{contagem(f)}</small>
          </button>
        ))}
      </div>

      {lista.length === 0 && <p className="vazio">{pessoas.length ? 'Ninguém com esse nome.' : 'Cadastre a primeira pessoa.'}</p>}
      <ul className="lista">
        {lista.map((p) => (
          <li key={p.id}>
            <Link to={`/pessoas/${p.id}`} className="item">
              <span className="avatar">{iniciais(p.nome)}</span>
              <div className="item-texto">
                <strong>{p.nome}</strong>
                <span>{p.tipo === 'membro' ? 'Membro' : 'Visitante'}{p.telefone && ` · ${p.telefone}`}</span>
              </div>
              <BotaoWhats telefone={p.telefone} />
            </Link>
          </li>
        ))}
      </ul>

      <Folha titulo="Nova pessoa" aberta={novo} fechar={() => setNovo(false)}>
        <FormPessoa salvo={(p) => { setNovo(false); navegar(`/pessoas/${p.id}`) }} />
      </Folha>
    </>
  )
}
