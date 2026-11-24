import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Compromisso, Culto, Pessoa } from '../lib/tipos'
import { dataBR, dinheiro, fimDia, hojeISO, horaBR, inicioDia, mesDia, podeFinanceiro, primeiroNome, situacaoPrazo } from '../lib/util'
import BotaoWhats from '../componentes/BotaoWhats'
import Icone from '../componentes/Icone'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Hoje() {
  const { igreja, userId, equipe, papel } = useSessao()
  const [minhas, setMinhas] = useState<Pessoa[]>([])
  const [agenda, setAgenda] = useState<Compromisso[]>([])
  const [faltaram, setFaltaram] = useState<Pessoa[]>([])
  const [ultimoCulto, setUltimoCulto] = useState<Culto | null>(null)
  const [presentes, setPresentes] = useState(0)
  const [aniversarios, setAniversarios] = useState<Pessoa[]>([])
  const [contagem, setContagem] = useState({ membros: 0, visitantes: 0, novosMes: 0 })
  const [entradasMes, setEntradasMes] = useState<number | null>(null)
  const [pronto, setPronto] = useState(false)

  const eu = equipe.find((e) => e.user_id === userId)
  const fin = podeFinanceiro(papel)

  useEffect(() => {
    if (!igreja) return
    const id = igreja.id
    const hoje = hojeISO()
    const mes = hoje.slice(0, 7)

    async function carregar() {
      const [p, a, c, todos, lanc] = await Promise.all([
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('responsavel_id', userId!)
          .eq('ativo', true).not('proximo_passo', 'is', null).order('prazo', { nullsFirst: false }),
        supabase.from('agenda').select('*').eq('igreja_id', id).eq('feito', false)
          .gte('inicio', inicioDia()).lte('inicio', fimDia()).order('inicio'),
        supabase.from('cultos').select('*').eq('igreja_id', id).lte('data', hoje)
          .order('data', { ascending: false }).limit(1),
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('ativo', true),
        fin ? supabase.from('lancamentos').select('valor').eq('igreja_id', id).neq('tipo', 'saida').gte('data', `${mes}-01`).lte('data', `${mes}-31`)
          : Promise.resolve({ data: null }),
      ])
      setMinhas(p.data ?? [])
      setAgenda(a.data ?? [])
      if (lanc.data) setEntradasMes((lanc.data as { valor: number }[]).reduce((s, l) => s + Number(l.valor), 0))

      const pessoas = (todos.data ?? []) as Pessoa[]
      setContagem({
        membros: pessoas.filter((x) => x.tipo === 'membro').length,
        visitantes: pessoas.filter((x) => x.tipo === 'visitante').length,
        novosMes: pessoas.filter((x) => x.criado_em.slice(0, 7) === mes).length,
      })

      const culto = (c.data?.[0] as Culto) ?? null
      setUltimoCulto(culto)
      if (culto) {
        const { data: pres } = await supabase.from('presencas').select('pessoa_id').eq('culto_id', culto.id)
        const vieram = new Set((pres ?? []).map((x: { pessoa_id: string }) => x.pessoa_id))
        setPresentes(vieram.size)
        setFaltaram(pessoas.filter((x) => x.tipo === 'membro' && !vieram.has(x.id)))
      }

      const dias = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + i)
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      setAniversarios(pessoas.filter((x) => x.nascimento && dias.includes(mesDia(x.nascimento)))
        .sort((x, y) => dias.indexOf(mesDia(x.nascimento!)) - dias.indexOf(mesDia(y.nascimento!))))
      setPronto(true)
    }
    carregar()
  }, [igreja?.id, userId, fin])

  if (!pronto) return <div className="spinner" />

  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const hojeTexto = d.charAt(0).toUpperCase() + d.slice(1)
  const pctPresenca = ultimoCulto && contagem.membros ? Math.round(((contagem.membros - faltaram.length) / contagem.membros) * 100) : null

  const atalhos = [
    { para: '/pessoas?novo=1', nome: 'Novo visitante', icone: 'mais_um' },
    { para: '/presenca', nome: 'Fazer chamada', icone: 'presenca' },
    ...(fin ? [{ para: '/financeiro?novo=1', nome: 'Lançar dízimo', icone: 'dinheiro' }] : []),
    { para: '/agenda?novo=1', nome: 'Marcar visita', icone: 'calendario_mais' },
  ]

  return (
    <div className="hoje">
      <header className="boas-vindas">
        <p className="data-hoje">{hojeTexto}</p>
        <h1 className="titulo">{saudacao()}{eu ? `, ${primeiroNome(eu.nome)}` : ''}</h1>
        <p className="suave">
          {minhas.length === 0
            ? 'Ninguém esperando um passo seu agora.'
            : `${minhas.length} ${minhas.length === 1 ? 'pessoa espera' : 'pessoas esperam'} um passo seu.`}
        </p>
      </header>

      <div className="atalhos">
        {atalhos.map((a) => (
          <Link key={a.para} to={a.para} className="atalho">
            <span><Icone nome={a.icone} tam={20} /></span>
            {a.nome}
          </Link>
        ))}
      </div>

      <div className="numeros">
        <Link to="/pessoas" className="numero">
          <span>Membros</span>
          <strong>{contagem.membros}</strong>
          <small>{contagem.novosMes > 0 ? `+${contagem.novosMes} cadastros este mês` : 'ativos'}</small>
        </Link>
        <Link to="/jornada" className="numero">
          <span>Visitantes</span>
          <strong>{contagem.visitantes}</strong>
          <small>em acompanhamento</small>
        </Link>
        <Link to="/presenca" className="numero">
          <span>Último culto</span>
          <strong>{ultimoCulto ? presentes : '—'}</strong>
          <small>{ultimoCulto ? `presentes · ${dataBR(ultimoCulto.data)}` : 'nenhuma chamada ainda'}</small>
          {pctPresenca !== null && <i className="barra"><b style={{ width: `${pctPresenca}%` }} /></i>}
        </Link>
        {fin ? (
          <Link to="/financeiro" className="numero">
            <span>Entradas do mês</span>
            <strong className="valor">{dinheiro(entradasMes ?? 0)}</strong>
            <small>dízimos e ofertas</small>
          </Link>
        ) : (
          <Link to="/aniversariantes" className="numero">
            <span>Aniversários</span>
            <strong>{aniversarios.length}</strong>
            <small>nos próximos 7 dias</small>
          </Link>
        )}
      </div>

      <div className="colunas">
        <div>
          <section className="painel">
            <h2>Pra você cuidar</h2>
            {minhas.length === 0 && <p className="vazio">Nenhuma pendência sua. Bom trabalho.</p>}
            <ul className="lista plana">
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

          {ultimoCulto && faltaram.length > 0 && (
            <section className="painel">
              <h2>Faltaram no culto de {dataBR(ultimoCulto.data)}</h2>
              <ul className="lista plana">
                {faltaram.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link to={`/pessoas/${p.id}`} className="item">
                      <div className="item-texto"><strong>{p.nome}</strong></div>
                      <BotaoWhats telefone={p.telefone}
                        texto={`Oi ${primeiroNome(p.nome)}! Sentimos sua falta no culto. Está tudo bem com você?`} />
                    </Link>
                  </li>
                ))}
              </ul>
              {faltaram.length > 6 && <Link className="link" to="/presenca">Ver todos os {faltaram.length}</Link>}
            </section>
          )}
        </div>

        <div>
          <section className="painel">
            <h2>Hoje na agenda</h2>
            {agenda.length === 0 && <p className="vazio">Nada marcado pra hoje. <Link className="link" to="/agenda?novo=1">Marcar visita</Link></p>}
            <ul className="lista plana">
              {agenda.map((a) => (
                <li key={a.id} className="item">
                  <span className="hora">{horaBR(a.inicio)}</span>
                  <div className="item-texto"><strong>{a.titulo}</strong>{a.local && <span>{a.local}</span>}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="painel">
            <h2>Aniversários da semana</h2>
            {aniversarios.length === 0 && <p className="vazio">Ninguém faz aniversário nos próximos dias.</p>}
            <ul className="lista plana">
              {aniversarios.map((p) => {
                const ehHoje = mesDia(p.nascimento!) === hojeISO().slice(5)
                return (
                  <li key={p.id} className={'item' + (ehHoje ? ' hoje' : '')}>
                    <span className="hora">{ehHoje ? 'Hoje' : dataBR(new Date().getFullYear() + '-' + mesDia(p.nascimento!))}</span>
                    <div className="item-texto"><strong>{p.nome}</strong></div>
                    <BotaoWhats telefone={p.telefone}
                      texto={`Feliz aniversário, ${primeiroNome(p.nome)}! Que Deus abençoe sua vida.`} />
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
