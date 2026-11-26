import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Compromisso, Pessoa } from '../lib/tipos'
import { dataBR, dinheiro, fimDia, hojeISO, horaBR, inicioDia, mesDia, podeFinanceiro, primeiroNome, situacaoPrazo } from '../lib/util'
import BotaoWhats from '../componentes/BotaoWhats'
import Contador from '../componentes/Contador'
import Icone from '../componentes/Icone'

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Hoje() {
  const { igreja, userId, equipe, papel, session } = useSessao()
  const [minhas, setMinhas] = useState<Pessoa[]>([])
  const [agenda, setAgenda] = useState<Compromisso[]>([])
  const [aniversarios, setAniversarios] = useState<Pessoa[]>([])
  const [contagem, setContagem] = useState({ membros: 0, visitantes: 0, novosMes: 0 })
  const [entradasMes, setEntradasMes] = useState<number | null>(null)
  const [pronto, setPronto] = useState(false)

  const eu = equipe.find((e) => e.user_id === userId)
  const fin = podeFinanceiro(papel)

  // conta só de gestão (ex.: a do desenvolvedor): não pede ficha
  const [semFicha, setSemFicha] = useState(() => session?.user.user_metadata?.sem_ficha === true)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user?.user_metadata?.sem_ficha === true) setSemFicha(true) })
  }, [])
  async function contaTecnica(e: { preventDefault: () => void; stopPropagation: () => void }) {
    e.preventDefault(); e.stopPropagation()
    setSemFicha(true)
    await supabase.auth.updateUser({ data: { sem_ficha: true } })
  }

  useEffect(() => {
    if (!igreja) return
    const id = igreja.id
    const hoje = hojeISO()
    const mes = hoje.slice(0, 7)

    async function carregar() {
      const [p, a, todos, lanc] = await Promise.all([
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('responsavel_id', userId!)
          .eq('ativo', true).not('proximo_passo', 'is', null).order('prazo', { nullsFirst: false }),
        supabase.from('agenda').select('*').eq('igreja_id', id).eq('feito', false)
          .gte('inicio', inicioDia()).lte('inicio', fimDia()).order('inicio'),
        supabase.from('pessoas').select('*').eq('igreja_id', id).eq('ativo', true),
        fin ? supabase.from('lancamentos').select('valor').eq('igreja_id', id).in('tipo', ['dizimo', 'oferta', 'outro']).gte('data', `${mes}-01`).lte('data', `${mes}-31`)
          : Promise.resolve({ data: null }),
      ])
      setMinhas(p.data ?? [])
      setAgenda(a.data ?? [])
      if (lanc.data) setEntradasMes((lanc.data as { valor: number }[]).reduce((s, l) => s + Number(l.valor), 0))

      const pessoas = (todos.data ?? []) as Pessoa[]
      setContagem({
        membros: pessoas.filter((x) => x.tipo === 'membro').length,
        visitantes: pessoas.filter((x) => x.tipo === 'visitante').length,
        novosMes: pessoas.filter((x) => x.tipo === 'membro' && x.criado_em.slice(0, 7) === mes).length,
      })


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

  const atalhos = [
    { para: '/pessoas?novo=1', nome: 'Novo visitante', icone: 'mais_um' },
    ...(fin ? [{ para: '/financeiro?novo=1', nome: 'Lançar dízimo', icone: 'dinheiro' }] : []),
    { para: '/agenda?novo=1', nome: 'Marcar visita', icone: 'calendario_mais' },
  ]

  return (
    <div className="hoje">
      <section className="capa">
        <svg className="capa-cruz" viewBox="0 0 100 100" aria-hidden="true"><path d="M40 6h20v28h28v20H60v40H40V54H12V34h28z" /></svg>
        <p className="data-hoje">{hojeTexto}</p>
        <h1 className="titulo">{saudacao()}{eu ? `, ${primeiroNome(eu.nome)}` : ''}</h1>
        <p className="capa-sub">
          {minhas.length === 0
            ? 'Ninguém esperando um passo seu agora.'
            : `${minhas.length} ${minhas.length === 1 ? 'pessoa espera' : 'pessoas esperam'} um passo seu.`}
        </p>
        <div className="atalhos">
          {atalhos.map((a) => (
            <Link key={a.para} to={a.para} className="atalho">
              <span><Icone nome={a.icone} tam={20} /></span>
              {a.nome}
            </Link>
          ))}
        </div>

      </section>

      {eu && !eu.pessoa_id && !semFicha && (
        <Link to="/minha-ficha" className="painel aviso-ficha">
          <div>
            <strong>Falta a sua ficha de membro</strong>
            <p className="suave">Você tem acesso à equipe, mas ainda não preencheu seus dados. Leva 2 minutos.</p>
          </div>
          <div className="aviso-ficha-acoes">
            <span className="btn btn-primario">Preencher</span>
            <button type="button" className="link" onClick={contaTecnica}>É conta só de gestão</button>
          </div>
        </Link>
      )}

      <div className="numeros">
        <Link to="/pessoas" className="numero com-icone">
          <i className="ic-redondo"><Icone nome="pessoas" tam={20} /></i>
          <span>Membros</span>
          <strong><Contador valor={contagem.membros} /></strong>
          <small>{contagem.novosMes > 0 && contagem.novosMes < contagem.membros ? `+${contagem.novosMes} novos este mês` : 'ativos na igreja'}</small>
        </Link>
        <Link to="/jornada" className="numero com-icone">
          <i className="ic-redondo"><Icone nome="jornada" tam={20} /></i>
          <span>Visitantes</span>
          <strong><Contador valor={contagem.visitantes} /></strong>
          <small>em acompanhamento</small>
        </Link>
        <Link to="/aniversariantes" className="numero com-icone">
          <i className="ic-redondo"><Icone nome="bolo" tam={20} /></i>
          <span>Aniversários</span>
          <strong><Contador valor={aniversarios.length} /></strong>
          <small>nos próximos 7 dias</small>
        </Link>
        {fin && (
          <Link to="/financeiro" className="numero com-icone">
          <i className="ic-redondo"><Icone nome="dinheiro" tam={20} /></i>
            <span>Entradas do mês</span>
            <strong className="valor"><Contador valor={entradasMes ?? 0} formato={dinheiro} /></strong>
            <small>dízimos e ofertas</small>
          </Link>
        )}
      </div>

      <div className="quadro-hoje">
        <div className="qh-col">
        {minhas.length > 0 && (
          <section className="painel">
            <h2>Pra você cuidar</h2>
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
        )}
        </div>
        <div className="qh-col">
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
