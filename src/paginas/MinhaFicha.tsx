import { useNavigate } from 'react-router-dom'
import { CompletarCadastro } from './NovaIgreja'

// Quem ganhou cargo antes de preencher a ficha preenche por aqui.
export default function MinhaFicha() {
  const ir = useNavigate()
  return <CompletarCadastro aoTerminar={() => ir('/')} />
}
