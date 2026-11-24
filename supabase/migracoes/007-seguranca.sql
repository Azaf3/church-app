-- =========================================================
-- 007 — Segurança
-- * Cargo (convite) e ligação com ficha antiga só com e-mail comprovado
--   (login pelo Google ou e-mail confirmado pelo link).
-- * Sem ligação por celular (não dá pra comprovar).
-- * Membro sem cargo não muda tipo, etapa, responsável etc. da própria ficha.
-- * Com cadastro aberto pro link, ninguém cria igreja nova pela API.
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

create or replace function igreja.email_comprovado()
returns boolean language sql stable security definer set search_path = igreja, auth as $$
  select exists (select 1 from auth.identities where user_id = auth.uid() and provider = 'google')
      or exists (select 1 from auth.users where id = auth.uid()
                 and email_confirmed_at is not null and confirmation_sent_at is not null);
$$;

create or replace function igreja.aceitar_convites()
returns int language plpgsql security definer set search_path = igreja as $$
declare v_email text; v_qtd int;
begin
  if not igreja.email_comprovado() then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  insert into igreja.equipe (igreja_id, user_id, nome, papel, pessoa_id)
    select c.igreja_id, auth.uid(), c.nome, c.papel, c.pessoa_id from igreja.convites c
    where lower(c.email) = v_email
  on conflict (igreja_id, user_id) do update
    set papel = excluded.papel, pessoa_id = coalesce(excluded.pessoa_id, igreja.equipe.pessoa_id);
  get diagnostics v_qtd = row_count;
  delete from igreja.convites where lower(email) = v_email;
  return v_qtd;
end $$;

create or replace function igreja.auto_cadastro(
  p_nome text, p_telefone text, p_nascimento date, p_tipo text,
  p_email text default null, p_telefone_fixo text default null,
  p_naturalidade text default null, p_cidade text default null, p_endereco text default null,
  p_data_conversao date default null, p_data_batismo date default null, p_aluno_ebd boolean default null,
  p_congregacao text default null
)
returns uuid language plpgsql security definer set search_path = igreja as $$
declare
  v_igreja uuid; v_email text; v_pessoa uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;

  select igreja_id into v_igreja from igreja.equipe where user_id = auth.uid() limit 1;
  if v_igreja is not null then return v_igreja; end if;

  select id into v_igreja from igreja.igrejas where cadastro_aberto order by criado_em limit 1;
  if v_igreja is null then raise exception 'cadastro fechado'; end if;

  select lower(email) into v_email from auth.users where id = auth.uid();

  -- só liga à ficha que já existe se o e-mail da conta for comprovado
  if igreja.email_comprovado() and v_email is not null then
    select p.id into v_pessoa from igreja.pessoas p
    where p.igreja_id = v_igreja and p.ativo and lower(p.email) = v_email
      and not exists (select 1 from igreja.equipe e where e.igreja_id = v_igreja and e.pessoa_id = p.id)
    limit 1;
  end if;

  if v_pessoa is not null then
    update igreja.pessoas set
      nome = coalesce(nullif(trim(p_nome), ''), nome),
      telefone = coalesce(nullif(trim(p_telefone), ''), telefone),
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
    values (v_igreja, trim(p_nome), nullif(trim(p_telefone), ''), v_email,
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

-- membro sem cargo só mexe nos dados de contato da própria ficha
create or replace function igreja.proteger_ficha()
returns trigger language plpgsql security definer set search_path = igreja as $$
begin
  if auth.uid() is not null and not igreja.sou_equipe(old.igreja_id) then
    new.igreja_id := old.igreja_id; new.tipo := old.tipo; new.etapa := old.etapa;
    new.responsavel_id := old.responsavel_id; new.proximo_passo := old.proximo_passo;
    new.prazo := old.prazo; new.ativo := old.ativo; new.observacoes := old.observacoes;
    new.criado_em := old.criado_em; new.email := old.email;
  end if;
  return new;
end $$;
drop trigger if exists proteger_ficha on igreja.pessoas;
create trigger proteger_ficha before update on igreja.pessoas for each row execute function igreja.proteger_ficha();

-- com cadastro aberto (instalação de uma igreja só), não deixa criar igreja nova
create or replace function igreja.criar_igreja(p_nome text, p_cidade text, p_meu_nome text)
returns uuid language plpgsql security definer set search_path = igreja as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if exists (select 1 from igreja.igrejas where cadastro_aberto) then raise exception 'novas igrejas desativadas'; end if;
  insert into igreja.igrejas (nome, cidade) values (p_nome, p_cidade) returning id into v_id;
  insert into igreja.equipe (igreja_id, user_id, nome, papel) values (v_id, auth.uid(), p_meu_nome, 'admin');
  return v_id;
end $$;

grant execute on all functions in schema igreja to authenticated;
