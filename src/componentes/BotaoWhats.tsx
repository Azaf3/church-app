import { linkWhats } from '../lib/util'
import Icone from './Icone'

export default function BotaoWhats({ telefone, texto, rotulo }: {
  telefone: string | null; texto?: string; rotulo?: string
}) {
  const link = linkWhats(telefone, texto)
  if (!link) return <span className="sem-tel">sem telefone</span>
  return (
    <a className={rotulo ? 'btn btn-whats' : 'btn-icone btn-whats'} href={link} target="_blank"
      rel="noreferrer" aria-label="Mandar WhatsApp" onClick={(e) => e.stopPropagation()}>
      <Icone nome="whats" tam={20} />
      {rotulo && <span>{rotulo}</span>}
    </a>
  )
}
