import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Pessoa } from '../lib/tipos'
import { ETAPAS } from '../lib/util'

type Dados = Partial<Pessoa>

export default function FormPessoa({ inicial, tipoPadrao = 'visitante', salvo }: {
  inicial?: Pessoa; tipoPadrao?: 'membro' | 'visitante'; salvo: (p: Pessoa) => void
}) {
  const { igreja, equipe, userId } = useSessao()
  const [d, setD] = useState<Dados>(inicial ?? {
    tipo: tipoPadrao,
    etapa: tipoPadrao === 'visitante' ? 'novo' : null,
    responsavel_id: userId,
    proximo_passo: tipoPadrao === 'visitante' ? ETAPAS[0].acao : null,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const campo = (k: keyof Pessoa) => ({
    value: (d[k] as string) ?? '',
    onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value || null }),
  })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!d.nome?.trim()) { setErro('Coloque o nome.'); return }
    setSalvando(true); setErro('')
    const registro = {
      igreja_id: igreja!.id,
      nome: d.nome.trim(),
      telefone: d.telefone ?? null,
      telefone_fixo: d.telefone_fixo ?? null,
      email: d.email ?? null,
      naturalidade: d.naturalidade ?? null,
      cidade: d.cidade ?? null,
      data_conversao: d.data_conversao ?? null,
      data_batismo: d.data_batismo ?? null,
      aluno_ebd: d.aluno_ebd ?? null,
      congregacao: d.congregacao ?? null,
      endereco: d.endereco ?? null,
      nascimento: d.nascimento ?? null,
      tipo: d.tipo ?? 'visitante',
      etapa: d.etapa ?? null,
      responsavel_id: d.responsavel_id ?? null,
      proximo_passo: d.proximo_passo ?? null,
      prazo: d.prazo ?? null,
      observacoes: d.observacoes ?? null,
    }
    const q = inicial
      ? supabase.from('pessoas').update(registro).eq('id', inicial.id).select().single()
      : supabase.from('pessoas').insert(registro).select().single()
    const { data, error } = await q
    setSalvando(false)
    if (error) { setErro('Não deu pra salvar. Tente de novo.'); return }
    salvo(data as Pessoa)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="seg">
        {(['visitante', 'membro'] as const).map((t) => (
          <button type="button" key={t} className={d.tipo === t ? 'ativo' : ''}
            onClick={() => setD({ ...d, tipo: t, etapa: t === 'visitante' ? (d.etapa ?? 'novo') : d.etapa })}>
            {t === 'visitante' ? 'Visitante' : 'Membro'}
          </button>
        ))}
      </div>

      <label>Nome<input {...campo('nome')} autoFocus={!inicial} /></label>
      <label>WhatsApp<input {...campo('telefone')} inputMode="tel" placeholder="(61) 99999-0000" /></label>
      <label>Endereço<input {...campo('endereco')} /></label>
      <label>Nascimento<input type="date" {...campo('nascimento')} /></label>

      <details className="detalhes" open={!!(d.email || d.data_batismo || d.cidade)}>
        <summary>Ficha de membro</summary>
        <div className="form">
          <label>E-mail<input type="email" {...campo('email')} /></label>
          <div className="linha-2">
            <label>Telefone fixo<input {...campo('telefone_fixo')} inputMode="tel" /></label>
            <label>Cidade<input {...campo('cidade')} /></label>
          </div>
          <label>Naturalidade<input {...campo('naturalidade')} placeholder="Ex.: Fortaleza - CE" /></label>
          <label>Onde congrega<input {...campo('congregacao')} /></label>
          <div className="linha-2">
            <label>Conversão<input type="date" {...campo('data_conversao')} /></label>
            <label>Batismo<input type="date" {...campo('data_batismo')} /></label>
          </div>
          <label>Aluno da EBD
            <select value={d.aluno_ebd == null ? '' : d.aluno_ebd ? 's' : 'n'}
              onChange={(e) => setD({ ...d, aluno_ebd: e.target.value === '' ? null : e.target.value === 's' })}>
              <option value="">Não informado</option><option value="s">Sim</option><option value="n">Não</option>
            </select>
          </label>
        </div>
      </details>

      <label>Responsável pelo cuidado
        <select {...campo('responsavel_id')}>
          <option value="">Ninguém ainda</option>
          {equipe.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
      </label>

      <label>Etapa na jornada
        <select {...campo('etapa')}>
          <option value="">Fora da jornada</option>
          {ETAPAS.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </label>

      <div className="linha-2">
        <label>Próximo passo<input {...campo('proximo_passo')} /></label>
        <label>Prazo<input type="date" {...campo('prazo')} /></label>
      </div>

      <label>Observações<textarea rows={3} {...campo('observacoes')} /></label>

      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" disabled={salvando}>
        {salvando ? 'Salvando…' : inicial ? 'Salvar alterações' : 'Cadastrar'}
      </button>
    </form>
  )
}
