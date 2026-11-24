-- =========================================================
-- ATENÇÃO: ESTE ARQUIVO APAGA TUDO DO SCHEMA "igreja" E RECRIA.
-- Use só na instalação nova. Banco que já tem dados: rode os
-- arquivos de supabase/migracoes/ em vez deste.
-- =========================================================
-- Gestão de igrejas — schema multi-igreja
-- Roda inteiro no SQL Editor do Supabase.
-- Fica num schema próprio ("igreja") pra conviver com outros
-- projetos no mesmo Supabase sem conflito de tabelas.
-- Depois: Settings > API > Exposed schemas > adicionar "igreja".
-- =========================================================

-- Recomeça do zero (apaga só o que é da igreja; outras tabelas do projeto não são tocadas)
drop schema if exists igreja cascade;
create schema igreja;
grant usage on schema igreja to anon, authenticated;

-- ---------- Tabelas ----------

create table igreja.igrejas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  cor text not null default '#1f5c4c' check (cor ~ '^#[0-9a-fA-F]{6}$'),
  logo text check (logo is null or (logo like 'data:image/%' and length(logo) < 300000)),
  criado_em timestamptz not null default now()
);

-- papel: admin (dono da conta), pastor, tesoureiro, obreiro
create table igreja.equipe (
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  papel text not null check (papel in ('admin','pastor','tesoureiro','obreiro')),
  pessoa_id uuid,  -- ligado a igreja.pessoas logo abaixo
  criado_em timestamptz not null default now(),
  primary key (igreja_id, user_id)
);

create table igreja.convites (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  email text not null,
  nome text not null,
  papel text not null check (papel in ('admin','pastor','tesoureiro','obreiro')),
  pessoa_id uuid,
  criado_em timestamptz not null default now(),
  unique (igreja_id, email)
);

-- membros e visitantes ficam na mesma tabela: visitante vira membro mudando o tipo
create table igreja.pessoas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  nome text not null,
  telefone text,
  endereco text,
  nascimento date,
  email text,
  telefone_fixo text,
  naturalidade text,
  cidade text,
  data_conversao date,
  data_batismo date,
  aluno_ebd boolean,
  congregacao text,
  tipo text not null default 'visitante' check (tipo in ('membro','visitante')),
  etapa text check (etapa in ('novo','relacionamento','integracao','membresia','pequeno_grupo')),
  responsavel_id uuid references auth.users(id) on delete set null,
  proximo_passo text,
  prazo date,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on igreja.pessoas (igreja_id, tipo);
create index on igreja.pessoas (igreja_id, responsavel_id);
alter table igreja.equipe   add foreign key (pessoa_id) references igreja.pessoas(id) on delete set null;
alter table igreja.convites add foreign key (pessoa_id) references igreja.pessoas(id) on delete set null;
create unique index equipe_pessoa_unica on igreja.equipe (igreja_id, pessoa_id) where pessoa_id is not null;

create table igreja.contatos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  pessoa_id uuid not null references igreja.pessoas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  meio text not null default 'whatsapp' check (meio in ('whatsapp','ligacao','visita','presencial')),
  nota text,
  criado_em timestamptz not null default now()
);
create index on igreja.contatos (pessoa_id, criado_em desc);

create table igreja.cultos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  data date not null,
  titulo text not null default 'Culto',
  criado_em timestamptz not null default now()
);
create index on igreja.cultos (igreja_id, data desc);

create table igreja.presencas (
  culto_id uuid not null references igreja.cultos(id) on delete cascade,
  pessoa_id uuid not null references igreja.pessoas(id) on delete cascade,
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  primary key (culto_id, pessoa_id)
);

create table igreja.lancamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  tipo text not null check (tipo in ('dizimo','oferta','outro','saida')),
  categoria text,
  descricao text,
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  pessoa_id uuid references igreja.pessoas(id) on delete set null,
  nome text,               -- nome de quem deu (quando não é cadastrado) ou descrição
  forma text not null default 'pix' check (forma in ('pix','dinheiro','cartao','transferencia')),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on igreja.lancamentos (igreja_id, data desc);

create table igreja.agenda (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'visita' check (tipo in ('visita','culto_no_lar','aconselhamento','reuniao','outro')),
  inicio timestamptz not null,
  local text,
  pessoa_id uuid references igreja.pessoas(id) on delete set null,
  responsavel_id uuid references auth.users(id) on delete set null,
  feito boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on igreja.agenda (igreja_id, inicio);

-- ---------- Funções de permissão ----------

create or replace function igreja.sou_da_igreja(p_igreja uuid)
returns boolean language sql stable security definer set search_path = igreja as $$
  select exists (select 1 from igreja.equipe where igreja_id = p_igreja and user_id = auth.uid());
$$;

create or replace function igreja.tenho_papel(p_igreja uuid, p_papeis text[])
returns boolean language sql stable security definer set search_path = igreja as $$
  select exists (select 1 from igreja.equipe
                 where igreja_id = p_igreja and user_id = auth.uid() and papel = any(p_papeis));
$$;

-- Cria igreja e coloca quem criou como admin
create or replace function igreja.criar_igreja(p_nome text, p_cidade text, p_meu_nome text)
returns uuid language plpgsql security definer set search_path = igreja as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into igreja.igrejas (nome, cidade) values (p_nome, p_cidade) returning id into v_id;
  insert into igreja.equipe (igreja_id, user_id, nome, papel) values (v_id, auth.uid(), p_meu_nome, 'admin');
  return v_id;
end $$;

-- Ao entrar, aceita convites feitos pro e-mail do usuário
create or replace function igreja.aceitar_convites()
returns int language plpgsql security definer set search_path = igreja as $$
declare v_email text; v_qtd int;
begin
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  insert into igreja.equipe (igreja_id, user_id, nome, papel, pessoa_id)
    select c.igreja_id, auth.uid(), c.nome, c.papel, c.pessoa_id from igreja.convites c
    where lower(c.email) = v_email
  on conflict do nothing;
  get diagnostics v_qtd = row_count;
  delete from igreja.convites where lower(email) = v_email;
  return v_qtd;
end $$;

grant execute on all functions in schema igreja to authenticated;

-- ---------- RLS ----------

alter table igreja.igrejas     enable row level security;
alter table igreja.equipe      enable row level security;
alter table igreja.convites    enable row level security;
alter table igreja.pessoas     enable row level security;
alter table igreja.contatos    enable row level security;
alter table igreja.cultos      enable row level security;
alter table igreja.presencas   enable row level security;
alter table igreja.lancamentos enable row level security;
alter table igreja.agenda      enable row level security;

grant select, insert, update, delete on all tables in schema igreja to authenticated;

create policy ver on igreja.igrejas for select using (igreja.sou_da_igreja(id));
create policy editar on igreja.igrejas for update using (igreja.tenho_papel(id, array['admin','pastor']));

create policy ver on igreja.equipe for select using (igreja.sou_da_igreja(igreja_id));
create policy gerir on igreja.equipe for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor']));

create policy gerir on igreja.convites for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor']));

-- Dados pastorais: toda a equipe vê e edita
create policy equipe on igreja.pessoas for all
  using (igreja.sou_da_igreja(igreja_id)) with check (igreja.sou_da_igreja(igreja_id));
create policy equipe on igreja.contatos for all
  using (igreja.sou_da_igreja(igreja_id)) with check (igreja.sou_da_igreja(igreja_id));
create policy equipe on igreja.cultos for all
  using (igreja.sou_da_igreja(igreja_id)) with check (igreja.sou_da_igreja(igreja_id));
create policy equipe on igreja.presencas for all
  using (igreja.sou_da_igreja(igreja_id)) with check (igreja.sou_da_igreja(igreja_id));
create policy equipe on igreja.agenda for all
  using (igreja.sou_da_igreja(igreja_id)) with check (igreja.sou_da_igreja(igreja_id));

-- Financeiro: só admin, pastor e tesoureiro
create policy financeiro on igreja.lancamentos for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
