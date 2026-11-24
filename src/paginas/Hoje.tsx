import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Compromisso, Culto, Pessoa } from '../lib/tipos'
import { dataBR, fimDia, hojeISO, inicioDia, horaBR, mesDia, primeiroNome, situacaoPrazo } from '../lib/util'
import BotaoWhats from '../componentes/BotaoWhats'

export default function Hoje() {
  const { igreja, userId, equipe } = useSessao()
  const [minhas, setMinhas] = useState<Pessoa[]>([])
  const [agenda, setAgenda] = useState<Compromisso[]>([])
  const [faltaram, setFaltaram] = useState<Pessoa[]>([])
  const [ultimoCulto, setUltimoCulto] = useState<Culto | null>(null)
  const [aniversarios, setAniversarios] = useState<Pessoa[]>([])
  const [pronto, setPronto] = useState(false)

  const eu = equipe.find((e) => e.user_id === userId)

  useEffect(() => {
    if (!igreja) return
    const id = igreja.id
    const hoje = hojeISO()

    async function carregar() {
      const [p, a, c, todos] = await Promise.all([
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('responsavel_id', userId!)
          .eq('ativo', true).not('proximo_passo', 'is', null).order('prazo', { nullsFirst: false }),
        supabase.from('agenda').select('*').eq('igreja_id', id).eq('feito', false)
          .gte('inicio', inicioDia()).lte('inicio', fimDia()).order('inicio'),
        supabase.from('cultos').select('*').eq('igreja_id', id).lte('data', hoje)
          .order('data', { ascending: false }).limit(1),
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('ativo', true),
      ])
      setMinhas(p.data ?? [])
      setAgenda(a.data ?? [])

      const pessoas = (todos.data ?? []) as Pessoa[]
      const culto = (c.data?.[0] as Culto) ?? null
      setUltimoCulto(culto)
      if (culto) {
        const { data: pres } = await supabase.from('presencas').select('pessoa_id').eq('culto_id', culto.id)
        const vieram = new Set((pres ?? []).map((x) => x.pessoa_id))
        setFaltaram(pessoas.filter((x) => x.tipo === 'membro' && !vieram.has(x.id)))
      }

      // aniversários dos próximos 7 dias
      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      setAniversarios(pessoas.filter((x) => x.nascimento && dias.includes(mesDia(x.nascimento)))
        .sort((x, y) => dias.indexOf(mesDia(x.nascimento!)) - dias.indexOf(mesDia(y.nascimento!))))
      setPronto(true)
    }
    carregar()
  }, [igreja?.id, userId])

  if (!pronto) return <div className="spinner" />

  return (
    <>
      <h1 className="titulo">Meu dia</h1>
      <p className="suave">
        {eu ? `${primeiroNome(eu.nome)}, ` : ''}
        {minhas.length} {minhas.length === 1 ? 'pessoa' : 'pessoas'} esperando um passo seu
      </p>

      <section>
        <h2 className="secao">Pra você cuidar</h2>
        {minhas.length === 0 && <p className="vazio">Ninguém pendente com você. Bom trabalho.</p>}
        <ul className="lista">
          {minhas.map((p) => {
            const s = situacaoPrazo(p.prazo)
            return (
              <li key={p.id}>
                <Link to={`/pessoas/${p.id}`} className="item">
                  <div className="item-texto">
                    <strong>{p.nome}</strong>
                    <span>{p.proximo_passo}{p.prazo && ` · ${dataBR(p.prazo)}`}</span>
                  </div>
                  {s && <span className={s.classe}>{s.rotulo}</span>}
                  <BotaoWhats telefone={p.telefone} texto={`Oi ${primeiroNome(p.nome)}, tudo bem?`} />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {agenda.length > 0 && (
        <section>
          <h2 className="secao">Hoje na agenda</h2>
          <ul className="lista">
            {agenda.map((a) => (
              <li key={a.id} className="item">
                <span className="hora">{horaBR(a.inicio)}</span>
                <div className="item-texto"><strong>{a.titulo}</strong>{a.local && <span>{a.local}</span>}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ultimoCulto && faltaram.length > 0 && (
        <section>
          <h2 className="secao">Faltaram no culto de {dataBR(ultimoCulto.data)}</h2>
          <ul className="lista">
            {faltaram.slice(0, 8).map((p) => (
              <li key={p.id}>
                <Link to={`/pessoas/${p.id}`} className="item">
                  <div className="item-texto"><strong>{p.nome}</strong></div>
                  <BotaoWhats telefone={p.telefone}
                    texto={`Oi ${primeiroNome(p.nome)}! Sentimos sua falta no culto. Está tudo bem com você?`} />
                </Link>
              </li>
            ))}
          </ul>
          {faltaram.length > 8 && <Link className="link" to="/presenca">Ver todos os {faltaram.length}</Link>}
        </section>
      )}

      {aniversarios.length > 0 && (
        <section>
          <h2 className="secao">Aniversários da semana</h2>
          <ul className="lista">
            {aniversarios.map((p) => (
              <li key={p.id} className="item">
                <span className="hora">{dataBR(new Date().getFullYear() + '-' + mesDia(p.nascimento!))}</span>
                <div className="item-texto"><strong>{p.nome}</strong></div>
                <BotaoWhats telefone={p.telefone}
                  texto={`Feliz aniversário, ${primeiroNome(p.nome)}! Que Deus abençoe sua vida.`} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
