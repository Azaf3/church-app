-- =========================================================
-- 005 — Cadastro pelo site com todas as perguntas da Ficha de Membro
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

-- "Local" da ficha = onde a pessoa congrega
alter table igreja.pessoas add column if not exists congregacao text;
update igreja.pessoas
  set congregacao = trim(substring(observacoes from '^Local: (.*)$')), observacoes = null
  where observacoes ~ '^Local: ' and congregacao is null;

drop function if exists igreja.auto_cadastro(text, text, date, text);
drop function if exists igreja.auto_cadastro(text, text, date, text, text, text, text, text, text, date, date, boolean);

create or replace function igreja.auto_cadastro(
  p_nome text, p_telefone text, p_nascimento date, p_tipo text,
  p_email text default null, p_telefone_fixo text default null,
  p_naturalidade text default null, p_cidade text default null, p_endereco text default null,
  p_data_conversao date default null, p_data_batismo date default null, p_aluno_ebd boolean default null,
  p_congregacao text default null
)
returns uuid language plpgsql security definer set search_path = igreja as $$
declare
  v_igreja uuid; v_email text; v_pessoa uuid; v_tel text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;

  select igreja_id into v_igreja from igreja.equipe where user_id = auth.uid() limit 1;
  if v_igreja is not null then return v_igreja; end if;

  select id into v_igreja from igreja.igrejas where cadastro_aberto order by criado_em limit 1;
  if v_igreja is null then raise exception 'cadastro fechado'; end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  v_tel := right(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'), 8);

  -- já preencheu a ficha antes (Forms/importação)? liga à mesma pessoa
  select p.id into v_pessoa from igreja.pessoas p
  where p.igreja_id = v_igreja and p.ativo
    and not exists (select 1 from igreja.equipe e where e.igreja_id = v_igreja and e.pessoa_id = p.id)
    and ((v_email is not null and lower(p.email) in (v_email, lower(nullif(trim(p_email), ''))))
      or (length(v_tel) = 8 and right(regexp_replace(coalesce(p.telefone, ''), '\D', '', 'g'), 8) = v_tel))
  order by (lower(p.email) = v_email) desc nulls last
  limit 1;

  if v_pessoa is not null then
    -- o que a pessoa respondeu agora vale; o que deixou em branco mantém
    update igreja.pessoas set
      nome = coalesce(nullif(trim(p_nome), ''), nome),
      telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
      email = coalesce(nullif(lower(trim(p_email)), ''), email, v_email),
      telefone_fixo = coalesce(nullif(trim(p_telefone_fixo), ''), telefone_fixo),
      nascimento = coalesce(p_nascimento, nascimento),
      naturalidade = coalesce(nullif(trim(p_naturalidade), ''), naturalidade),
      cidade = coalesce(nullif(trim(p_cidade), ''), cidade),
      endereco = coalesce(nullif(trim(p_endereco), ''), endereco),
      data_conversao = coalesce(p_data_conversao, data_conversao),
      data_batismo = coalesce(p_data_batismo, data_batismo),
      aluno_ebd = coalesce(p_aluno_ebd, aluno_ebd),
      congregacao = coalesce(nullif(trim(p_congregacao), ''), congregacao)
    where id = v_pessoa;
  else
    insert into igreja.pessoas (igreja_id, nome, telefone, email, telefone_fixo, nascimento, naturalidade,
                                cidade, endereco, data_conversao, data_batismo, aluno_ebd, congregacao, tipo, etapa, proximo_passo)
    values (v_igreja, trim(p_nome), nullif(trim(p_telefone), ''), coalesce(nullif(lower(trim(p_email)), ''), v_email),
            nullif(trim(p_telefone_fixo), ''), p_nascimento, nullif(trim(p_naturalidade), ''), nullif(trim(p_cidade), ''),
            nullif(trim(p_endereco), ''), p_data_conversao, p_data_batismo, p_aluno_ebd, nullif(trim(p_congregacao), ''),
            case when p_tipo = 'visitante' then 'visitante' else 'membro' end,
            case when p_tipo = 'visitante' then 'novo' end,
            case when p_tipo = 'visitante' then 'Fazer o primeiro contato' end)
    returning id into v_pessoa;
  end if;

  insert into igreja.equipe (igreja_id, user_id, nome, papel, pessoa_id)
  values (v_igreja, auth.uid(), (select nome from igreja.pessoas where id = v_pessoa), 'membro', v_pessoa);
  return v_igreja;
end $$;

grant execute on function igreja.auto_cadastro(text, text, date, text, text, text, text, text, text, date, date, boolean, text) to authenticated;
