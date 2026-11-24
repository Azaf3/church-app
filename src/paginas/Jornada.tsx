import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Etapa, Pessoa } from '../lib/tipos'
import { ETAPAS, iniciais, situacaoPrazo } from '../lib/util'

export default function Jornada() {
  const { igreja, nomeDe } = useSessao()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [ativa, setAtiva] = useState<Etapa>('novo')

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true)
      .not('etapa', 'is', null).order('prazo', { nullsFirst: false })
      .then(({ data }) => setPessoas(data ?? []))
  }, [igreja?.id])

  async function avancar(p: Pessoa) {
    const i = ETAPAS.findIndex((e) => e.id === p.etapa)
    const prox = ETAPAS[i + 1]
    const mudanca = prox
      ? { etapa: prox.id, proximo_passo: prox.acao, prazo: null, tipo: prox.id === 'membresia' ? 'membro' : p.tipo }
      : { etapa: null, proximo_passo: null, prazo: null } // concluiu a jornada
    const { data } = await supabase.from('pessoas').update(mudanca).eq('id', p.id).select().single()
    if (data) setPessoas((lista) => lista.map((x) => (x.id === p.id ? data : x)).filter((x) => x.etapa))
  }

  return (
    <>
      <h1 className="titulo">Jornada dos visitantes</h1>
      <p className="suave">Do primeiro culto até servir. Toque em “Avançar” quando o passo for dado.</p>

      {/* No celular mostra uma coluna por vez; em tela larga mostra todas */}
      <div className="seg rolavel">
        {ETAPAS.map((e) => (
          <button key={e.id} className={ativa === e.id ? 'ativo' : ''} onClick={() => setAtiva(e.id)}>
            {e.nome} <small>{pessoas.filter((p) => p.etapa === e.id).length}</small>
          </button>
        ))}
      </div>

      <div className="quadro">
        {ETAPAS.map((e, i) => {
          const da = pessoas.filter((p) => p.etapa === e.id)
          return (
            <section key={e.id} className={'coluna' + (ativa === e.id ? ' visivel' : '')}>
              <h2>{e.nome} <small>{da.length}</small></h2>
              {da.length === 0 && <p className="vazio">Ninguém nesta etapa.</p>}
              {da.map((p) => {
                const s = situacaoPrazo(p.prazo)
                return (
                  <article key={p.id} className="card">
                    <Link to={`/pessoas/${p.id}`} className="card-cabeca">
                      <span className="avatar pequeno">{iniciais(p.nome)}</span>
                      <strong>{p.nome}</strong>
                    </Link>
                    <p>{p.proximo_passo}</p>
                    <div className="card-pe">
                      <small>{p.responsavel_id ? nomeDe(p.responsavel_id) : <span className="tag tag-alerta">Sem responsável</span>}</small>
                      {s && <span className={s.classe}>{s.rotulo}</span>}
                      <button className="btn btn-mini" onClick={() => avancar(p)}>
                        {i === ETAPAS.length - 1 ? 'Concluir' : 'Avançar'}
                      </button>
                    </div>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}
