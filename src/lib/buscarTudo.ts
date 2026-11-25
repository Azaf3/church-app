// O Supabase devolve no máximo 1000 linhas por vez: busca em páginas até acabar.
type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function buscarTudo<T>(pagina: (de: number, ate: number) => Resposta<T>) {
  const tudo: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await pagina(de, de + 999)
    if (error) return { data: null, error }
    tudo.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return { data: tudo, error: null }
}
