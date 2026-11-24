import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Pessoa } from '../lib/tipos'
import { dataBR, primeiroNome } from '../lib/util'
import LogoIgreja from '../componentes/LogoIgreja'
import Icone from '../componentes/Icone'

// O que um membro sem cargo vê: só a própria ficha, pra manter atualizada.
export default function AreaMembro() {
  const { igreja, equipe, userId, sair } = useSessao()
  const eu = equipe.find((e) => e.user_id === userId)
  const [p, setP] = useState<Pessoa | null>(null)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    if (!eu?.pessoa_id) return
    supabase.from('pessoas').select('*').eq('id', eu.pessoa_id).single().then(({ data }) => setP(data))
  }, [eu?.pessoa_id])

  return (
    <div className="area-membro">
      <header className="topo">
        <LogoIgreja igreja={igreja} tam={28} />
        <strong>{igreja?.nome}</strong>
        <button className="btn-icone" onClick={sair} aria-label="Sair" style={{ marginLeft: 'auto' }}><Icone nome="sair" tam={19} /></button>
      </header>
      <main className="conteudo">
        <p className="data-hoje">Que bom ter você aqui</p>
        <h1 className="titulo">Olá{p ? `, ${primeiroNome(p.nome)}` : ''}!</h1>
        <p className="suave">
          Este é o seu cadastro na {igreja?.nome}. Mantenha seus dados em dia pra igreja conseguir cuidar de você.
          Se você servir em algum ministério, o pastor libera as outras funções do app.
        </p>

        {!p ? <div className="spinner" /> : editando
          ? <EditarFicha p={p} pronto={(n) => { setP(n); setEditando(false) }} cancelar={() => setEditando(false)} />
          : (
            <section className="painel">
              <h2>Minha ficha</h2>
              <dl className="dados">
                <div className="largo"><dt>Nome</dt><dd>{p.nome}</dd></div>
                <div><dt>Celular</dt><dd>{p.telefone || '—'}</dd></div>
                <div><dt>E-mail</dt><dd>{p.email || '—'}</dd></div>
                <div><dt>Nascimento</dt><dd>{p.nascimento ? dataBR(p.nascimento) : '—'}</dd></div>
                <div><dt>Cidade</dt><dd>{p.cidade || '—'}</dd></div>
                <div className="largo"><dt>Endereço</dt><dd>{p.endereco || '—'}</dd></div>
                <div><dt>Conversão</dt><dd>{p.data_conversao ? dataBR(p.data_conversao) : '—'}</dd></div>
                <div><dt>Batismo</dt><dd>{p.data_batismo ? dataBR(p.data_batismo) : '—'}</dd></div>
                <div><dt>Naturalidade</dt><dd>{p.naturalidade || '—'}</dd></div>
                <div><dt>Telefone residencial</dt><dd>{p.telefone_fixo || '—'}</dd></div>
                <div><dt>Onde congrega</dt><dd>{p.congregacao || '—'}</dd></div>
                <div><dt>Aluno da EBD</dt><dd>{p.aluno_ebd == null ? '—' : p.aluno_ebd ? 'Sim' : 'Não'}</dd></div>
              </dl>
              <div className="acoes" style={{ marginTop: 16 }}>
                <button className="btn btn-primario" onClick={() => setEditando(true)}>Atualizar meus dados</button>
              </div>
            </section>
          )}
      </main>
    </div>
  )
}

function EditarFicha({ p, pronto, cancelar }: { p: Pessoa; pronto: (n: Pessoa) => void; cancelar: () => void }) {
  const [d, setD] = useState({
    telefone: p.telefone ?? '', nascimento: p.nascimento ?? '', cidade: p.cidade ?? '',
    endereco: p.endereco ?? '', naturalidade: p.naturalidade ?? '', data_conversao: p.data_conversao ?? '', data_batismo: p.data_batismo ?? '',
    telefone_fixo: p.telefone_fixo ?? '', congregacao: p.congregacao ?? '',
  })
  const [ebd, setEbd] = useState<boolean | null>(p.aluno_ebd)
  const [erro, setErro] = useState('')
  const campo = (k: keyof typeof d) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }) })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo = { ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null])), aluno_ebd: ebd }
    const { data, error } = await supabase.from('pessoas').update(limpo).eq('id', p.id).select().single()
    if (error || !data) { setErro('Não deu pra salvar.'); return }
    pronto(data)
  }

  return (
    <form className="painel form" onSubmit={enviar}>
      <h2>Atualizar meus dados</h2>
      <div className="linha-2">
        <label>Celular<input inputMode="tel" {...campo('telefone')} /></label>
        <label>Telefone residencial<input inputMode="tel" {...campo('telefone_fixo')} /></label>
      </div>
      <div className="linha-2">
        <label>Nascimento<input type="date" {...campo('nascimento')} /></label>
        <label>Cidade<input {...campo('cidade')} /></label>
      </div>
      <label>Endereço<input {...campo('endereco')} /></label>
      <label>Naturalidade<input {...campo('naturalidade')} /></label>
      <div className="linha-2">
        <label>Conversão<input type="date" {...campo('data_conversao')} /></label>
        <label>Batismo<input type="date" {...campo('data_batismo')} /></label>
      </div>
      <label>Onde congrega<input {...campo('congregacao')} /></label>
      <fieldset className="pergunta">
        <legend>Aluno da EBD?</legend>
        <div className="seg">
          <button type="button" className={ebd === true ? 'ativo' : ''} onClick={() => setEbd(true)}>Sim</button>
          <button type="button" className={ebd === false ? 'ativo' : ''} onClick={() => setEbd(false)}>Não</button>
        </div>
      </fieldset>
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="btn btn-primario">Salvar</button>
        <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  )
}
