import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Pessoa } from '../lib/tipos'
import { MESES, primeiroNome } from '../lib/util'
import BotaoWhats from '../componentes/BotaoWhats'
import Icone from '../componentes/Icone'

export default function Aniversariantes() {
  const { igreja } = useSessao()
  const [mes, setMes] = useState(new Date().getMonth())
  const [pessoas, setPessoas] = useState<Pessoa[]>([])

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true).not('nascimento', 'is', null)
      .then(({ data }) => setPessoas(data ?? []))
  }, [igreja?.id])

  const doMes = pessoas
    .filter((p) => Number(p.nascimento!.slice(5, 7)) === mes + 1)
    .sort((a, b) => a.nascimento!.slice(8).localeCompare(b.nascimento!.slice(8)))

  const hoje = new Date()
  // mês que já passou neste ano: o próximo aniversário é no ano que vem
  const anoDoMes = mes < hoje.getMonth() ? hoje.getFullYear() + 1 : hoje.getFullYear()
  const idade = (n: string) => anoDoMes - Number(n.slice(0, 4))

  return (
    <>
      <h1 className="titulo">Aniversariantes</h1>
      <div className="mes">
        <button className="btn-icone" onClick={() => setMes((mes + 11) % 12)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
        <strong>{MESES[mes]}{anoDoMes !== hoje.getFullYear() ? ` de ${anoDoMes}` : ''}</strong>
        <button className="btn-icone" onClick={() => setMes((mes + 1) % 12)} aria-label="Próximo mês"><Icone nome="seta" /></button>
      </div>

      {doMes.length === 0 && <p className="vazio">Ninguém faz aniversário em {MESES[mes].toLowerCase()}.</p>}
      <ul className="lista">
        {doMes.map((p) => {
          const dia = Number(p.nascimento!.slice(8))
          const ehHoje = mes === hoje.getMonth() && dia === hoje.getDate()
          const jaFez = mes === hoje.getMonth() && dia < hoje.getDate()
          return (
            <li key={p.id} className={'item' + (ehHoje ? ' hoje' : '')}>
              <span className="dia">{dia}</span>
              <div className="item-texto">
                <strong>{p.nome}</strong>
                <span>{ehHoje ? 'Hoje! faz' : jaFez ? 'fez' : 'vai fazer'} {idade(p.nascimento!)} anos</span>
              </div>
              <BotaoWhats telefone={p.telefone} texto={`Feliz aniversário, ${primeiroNome(p.nome)}! Que Deus abençoe sua vida.`} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
