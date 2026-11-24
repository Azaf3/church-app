-- =========================================================
-- 008 — Caixas (Geral, Missões, SETE), saldo inicial, controle do SETE
--       e ficha com escolaridade, profissão, CPF e faixa de renda
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

-- ---------- Tesouraria ----------
alter table igreja.lancamentos add column if not exists fundo text not null default 'geral';
alter table igreja.lancamentos drop constraint if exists lancamentos_fundo_check;
alter table igreja.lancamentos add  constraint lancamentos_fundo_check check (fundo in ('geral','missoes','sete'));
alter table igreja.lancamentos drop constraint if exists lancamentos_tipo_check;
alter table igreja.lancamentos add  constraint lancamentos_tipo_check check (tipo in ('dizimo','oferta','outro','saida','saldo_inicial'));
create index if not exists lancamentos_fundo on igreja.lancamentos (igreja_id, fundo, data);

-- ---------- Ficha: dados comuns ----------
alter table igreja.pessoas add column if not exists escolaridade text;
alter table igreja.pessoas add column if not exists profissao text;

-- ---------- Ficha: dados sensíveis (CPF e faixa de renda) ----------
-- Tabela à parte: só admin, tesoureiro e a própria pessoa enxergam.
create table if not exists igreja.dados_sensiveis (
  pessoa_id uuid primary key references igreja.pessoas(id) on delete cascade,
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  cpf text check (cpf is null or cpf ~ '^\d{11}$'),
  renda_faixa text,
  atualizado_em timestamptz not null default now()
);
alter table igreja.dados_sensiveis enable row level security;
grant select, insert, update, delete on igreja.dados_sensiveis to authenticated;

drop policy if exists gestao on igreja.dados_sensiveis;
create policy gestao on igreja.dados_sensiveis for all
  using (igreja.tenho_papel(igreja_id, array['admin','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','tesoureiro']));
drop policy if exists propria on igreja.dados_sensiveis;
create policy propria on igreja.dados_sensiveis for all
  using (pessoa_id = igreja.minha_pessoa(igreja_id))
  with check (pessoa_id = igreja.minha_pessoa(igreja_id));

-- ---------- SETE (seminário) ----------
create table if not exists igreja.sete_turmas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  nome text not null,
  inicio date not null,               -- primeiro mês de mensalidade
  meses int not null default 10 check (meses between 1 and 48),
  valor_matricula numeric(10,2),
  valor_mensalidade numeric(10,2),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists igreja.sete_alunos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  turma_id uuid not null references igreja.sete_turmas(id) on delete cascade,
  pessoa_id uuid references igreja.pessoas(id) on delete set null,
  nome text not null,
  telefone text,
  situacao text not null default 'ativo' check (situacao in ('ativo','desistente','concluiu')),
  observacoes text,
  criado_em timestamptz not null default now()
);

-- referencia: '0000-00' = matrícula; 'AAAA-MM' = mensalidade daquele mês
create table if not exists igreja.sete_pagamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  aluno_id uuid not null references igreja.sete_alunos(id) on delete cascade,
  referencia text not null check (referencia ~ '^\d{4}-\d{2}$'),
  situacao text not null check (situacao in ('pago','isento')),
  valor numeric(10,2),
  pago_em date,
  lancamento_id uuid references igreja.lancamentos(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (aluno_id, referencia)
);

alter table igreja.sete_turmas     enable row level security;
alter table igreja.sete_alunos     enable row level security;
alter table igreja.sete_pagamentos enable row level security;
grant select, insert, update, delete on igreja.sete_turmas, igreja.sete_alunos, igreja.sete_pagamentos to authenticated;

drop policy if exists tesouraria on igreja.sete_turmas;
create policy tesouraria on igreja.sete_turmas for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
drop policy if exists tesouraria on igreja.sete_alunos;
create policy tesouraria on igreja.sete_alunos for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
drop policy if exists tesouraria on igreja.sete_pagamentos;
create policy tesouraria on igreja.sete_pagamentos for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
