import { useEffect, useRef, useState } from 'react'

const semMovimento = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// número que "corre" até o valor: do zero na primeira vez, do valor anterior quando muda (ex.: trocar de mês)
export default function Contador({ valor, formato = (n) => String(Math.round(n)), duracao = 700 }: {
  valor: number; formato?: (n: number) => string; duracao?: number
}) {
  const [mostra, setMostra] = useState(semMovimento() ? valor : 0)
  const atual = useRef(mostra)

  useEffect(() => {
    if (semMovimento()) { atual.current = valor; setMostra(valor); return }
    const de = atual.current, inicio = performance.now()
    let quadro = 0
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao)
      const v = de + (valor - de) * (1 - Math.pow(1 - p, 3))
      atual.current = v; setMostra(v)
      if (p < 1) quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [valor, duracao])

  return <>{formato(mostra)}</>
}
