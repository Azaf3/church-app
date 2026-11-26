-- Categorias de saída pedidas pelo tesoureiro + correção da data do aluguel SETE de junho (vinha 07/07 na planilha)
update igreja.lancamentos set data = '2026-06-07'
 where data = '2026-07-07' and tipo = 'saida' and valor = 1000 and descricao ilike 'Pagamento (aluguel espa%SETE%';

create or replace function igreja._nova_categoria(txt text, antiga text) returns text language sql immutable as $$
  select case
    when d ~ 'fgtm' then 'FGTM'
    when d ~ 'prebenda|antecipac' then 'Prebenda pastoral'
    when d ~ 'aluguel|alugueis|locacao|condominio' then 'Aluguéis'
    when d ~ 'miss(ao|oes)|missionar|gilson|vem viver' then 'Oferta Missionária'
    when d ~ '\msete\M|seminario|apostila|aula|professor' then 'SETE (aulas/apostilas)'
    when d ~ 'neoenergia|energia|enel|\mceb\M|caesb|\magua\M|internet|\mluz\M' then 'Neoenergia, água e Internet'
    when antiga = 'Água, luz e internet' then 'Neoenergia, água e Internet'
    when antiga = 'Aluguel' then 'Aluguéis'
    when antiga = 'Sustento missionário' then 'Oferta Missionária'
    when antiga in ('Professores e aulas', 'Material e apostilas') then 'SETE (aulas/apostilas)'
    when antiga in ('Prebenda pastoral', 'FGTM', 'Aluguéis', 'Oferta Missionária', 'SETE (aulas/apostilas)', 'Neoenergia, água e Internet') then antiga
    else 'Outros' end
  from (select translate(lower(coalesce(txt, '')), 'áàâãéêíóôõúç', 'aaaaeeiooouc') d) x
$$;

update igreja.lancamentos set categoria = igreja._nova_categoria(coalesce(descricao, '') || ' ' || coalesce(nome, ''), categoria) where tipo = 'saida';
update igreja.despesas_fixas set categoria = igreja._nova_categoria(descricao, categoria);
drop function igreja._nova_categoria(text, text);

select categoria, count(*), sum(valor) from igreja.lancamentos where tipo = 'saida' group by 1 order by 3 desc;
