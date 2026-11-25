-- Dízimo/oferta lançado no caixa já com o contribuinte (alimenta a relação sozinho)
alter table igreja.lancamentos add column if not exists contribuinte_id uuid references igreja.contribuintes(id) on delete set null;
create index if not exists lancamentos_contribuinte on igreja.lancamentos (contribuinte_id) where contribuinte_id is not null;

-- Despesas que se repetem todo mês (aluguel, prebenda, luz...): lançadas com um toque
create table if not exists igreja.despesas_fixas (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null check (valor > 0),
  fundo text not null default 'geral' check (fundo in ('geral','missoes','sete')),
  dia int not null default 5 check (dia between 1 and 31),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table igreja.lancamentos add column if not exists fixa_id uuid references igreja.despesas_fixas(id) on delete set null;

alter table igreja.despesas_fixas enable row level security;
grant select, insert, update, delete on igreja.despesas_fixas to authenticated;
drop policy if exists tesouraria on igreja.despesas_fixas;
create policy tesouraria on igreja.despesas_fixas for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));
