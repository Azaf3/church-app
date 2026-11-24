import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { APP_ICONE, APP_NOME, NOVAS_IGREJAS } from '../config'

// Primeiro acesso de quem ainda não está em nenhuma igreja.
// NOVAS_IGREJAS=false: completa o cadastro e entra como membro desta igreja.
export default function NovaIgreja() {
  return NOVAS_IGREJAS ? <CadastrarIgreja /> : <CompletarCadastro />
}

function Logo() {
  return <img className="entrada-logo" src={import.meta.env.BASE_URL + APP_ICONE} alt=""
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
}

function CompletarCadastro() {
  const { recarregar, sair, session } = useSessao()
  const nomeGoogle = (session?.user.user_metadata?.full_name as string | undefined) ?? ''
  const [tipo, setTipo] = useState<'membro' | 'visitante'>('membro')
  const [d, setD] = useState({
    nome: nomeGoogle, nascimento: '', naturalidade: '', cidade: '', endereco: '',
    data_conversao: '', data_batismo: '', email: session?.user.email ?? '', telefone_fixo: '', telefone: '', congregacao: '',
  })
  const [ebd, setEbd] = useState<'' | 'sim' | 'nao'>('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const campo = (k: keyof typeof d) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }) })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const v = (x: string) => x.trim() || null
    const { error } = await supabase.rpc('auto_cadastro', {
      p_nome: d.nome, p_telefone: d.telefone, p_nascimento: v(d.nascimento), p_tipo: tipo,
      p_email: v(d.email), p_telefone_fixo: v(d.telefone_fixo), p_naturalidade: v(d.naturalidade),
      p_cidade: v(d.cidade), p_endereco: v(d.endereco), p_data_conversao: v(d.data_conversao),
      p_data_batismo: v(d.data_batismo), p_aluno_ebd: ebd === '' ? null : ebd === 'sim', p_congregacao: v(d.congregacao),
    })
    setEnviando(false)
    if (error) {
      setErro(/fechado/.test(error.message) ? 'O cadastro pelo site ainda não foi aberto. Fale com a secretaria.' : 'Não deu pra concluir. Confira os dados e tente de novo.')
      return
    }
    await recarregar()
  }

  return (
    <div className="entrada cadastro">
      <div className="entrada-cartao">
        <Logo />
        <h1>Ficha de membro</h1>
        <p className="suave">Bem-vindo à {APP_NOME}! Preencha sua ficha. Se você já preencheu antes, a gente atualiza a mesma ficha pelo seu e-mail ou celular.</p>
        <form className="form" onSubmit={enviar}>
          <div className="seg">
            <button type="button" className={tipo === 'membro' ? 'ativo' : ''} onClick={() => setTipo('membro')}>Sou membro</button>
            <button type="button" className={tipo === 'visitante' ? 'ativo' : ''} onClick={() => setTipo('visitante')}>Estou visitando</button>
          </div>

          <label>Nome completo *<input required {...campo('nome')} autoComplete="name" /></label>
          <div className="linha-2">
            <label>Data de nascimento<input type="date" {...campo('nascimento')} /></label>
            <label>Naturalidade/UF<input {...campo('naturalidade')} placeholder="Ex.: Fortaleza/CE" /></label>
          </div>
          <label>Cidade<input {...campo('cidade')} placeholder="Ex.: Gama" /></label>
          <label>Endereço, CEP e bairro<textarea rows={2} {...campo('endereco')} autoComplete="street-address" /></label>
          <div className="linha-2">
            <label>Data da conversão<input type="date" {...campo('data_conversao')} /></label>
            <label>Data do batismo<input type="date" {...campo('data_batismo')} /></label>
          </div>
          <label>E-mail<input type="email" {...campo('email')} autoComplete="email" /></label>
          <div className="linha-2">
            <label>Celular (WhatsApp) *<input required inputMode="tel" {...campo('telefone')} placeholder="(61) 99999-0000" autoComplete="tel" /></label>
            <label>Telefone residencial<input inputMode="tel" {...campo('telefone_fixo')} /></label>
          </div>
          <fieldset className="pergunta">
            <legend>Aluno da EBD?</legend>
            <div className="seg">
              <button type="button" className={ebd === 'sim' ? 'ativo' : ''} onClick={() => setEbd('sim')}>Sim</button>
              <button type="button" className={ebd === 'nao' ? 'ativo' : ''} onClick={() => setEbd('nao')}>Não</button>
            </div>
          </fieldset>

          <label>Onde congrega<input {...campo('congregacao')} placeholder="Ex.: Gama, prédio da faculdade Apogeu" /></label>

          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Salvando…' : 'Enviar ficha'}</button>
        </form>
        <p className="dica">Entrou como {session?.user.email}. <button className="link" onClick={sair}>Usar outra conta</button></p>
      </div>
    </div>
  )
}

function CadastrarIgreja() {
  const { recarregar, sair, session } = useSessao()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [meuNome, setMeuNome] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const { error } = await supabase.rpc('criar_igreja', { p_nome: nome, p_cidade: cidade, p_meu_nome: meuNome })
    setEnviando(false)
    if (error) { setErro('Não deu pra criar. Tente de novo.'); return }
    await recarregar()
  }

  return (
    <div className="entrada">
      <div className="entrada-cartao">
        <h1>Cadastre sua igreja</h1>
        <p className="suave">Se você foi convidado por alguém da equipe, peça pra liberarem o e-mail <b>{session?.user.email}</b> e entre de novo.</p>
        <form className="form" onSubmit={enviar}>
          <label>Nome da igreja<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Cidade<input value={cidade} onChange={(e) => setCidade(e.target.value)} /></label>
          <label>Seu nome<input required value={meuNome} onChange={(e) => setMeuNome(e.target.value)} /></label>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Começar'}</button>
        </form>
        <button className="link" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
