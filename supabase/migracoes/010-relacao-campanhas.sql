-- Tesouraria: campanhas e relação de dizimistas/ofertantes (mês a mês, igual à planilha)

alter table igreja.lancamentos add column if not exists campanha text;

-- quem contribui: identificado por código (a planilha usa códigos anonimizados) e, se quiser, ligado à ficha
create table if not exists igreja.contribuintes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  codigo text not null,
  nome text,
  pessoa_id uuid references igreja.pessoas(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (igreja_id, codigo)
);

create table if not exists igreja.contribuicoes (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  contribuinte_id uuid not null references igreja.contribuintes(id) on delete cascade,
  ano int not null check (ano between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  tipo text not null check (tipo in ('dizimo','oferta')),
  valor numeric(12,2) not null check (valor > 0),
  criado_em timestamptz not null default now(),
  unique (contribuinte_id, ano, mes, tipo)
);
create index if not exists contribuicoes_igreja_ano on igreja.contribuicoes (igreja_id, ano);

alter table igreja.contribuintes enable row level security;
alter table igreja.contribuicoes enable row level security;
grant select, insert, update, delete on igreja.contribuintes, igreja.contribuicoes to authenticated;

drop policy if exists tesouraria on igreja.contribuintes;
create policy tesouraria on igreja.contribuintes for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
drop policy if exists tesouraria on igreja.contribuicoes;
create policy tesouraria on igreja.contribuicoes for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
