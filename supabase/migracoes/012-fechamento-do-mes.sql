-- Fechamento do mês: confere o saldo do livro com o extrato do banco e trava o mês
create table if not exists igreja.fechamentos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  situacao text not null default 'fechado' check (situacao in ('fechado','reaberto')),
  saldo_livro numeric(12,2) not null,
  saldo_banco numeric(12,2),
  observacao text,
  fechado_por uuid references auth.users(id) on delete set null,
  fechado_por_nome text,
  fechado_em timestamptz not null default now(),
  reaberto_por_nome text,
  reaberto_em timestamptz,
  motivo_reabertura text,
  unique (igreja_id, mes)
);
alter table igreja.fechamentos enable row level security;
grant select, insert, update on igreja.fechamentos to authenticated;
drop policy if exists tesouraria on igreja.fechamentos;
create policy tesouraria on igreja.fechamentos for all
  using (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']))
  with check (igreja.tenho_papel(igreja_id, array['admin','pastor','tesoureiro']));

-- mês fechado não aceita lançamento novo, mudança nem exclusão
create or replace function igreja.travar_mes_fechado() returns trigger
language plpgsql security definer set search_path = igreja, public as $$
declare v_igreja uuid; v_meses text[];
begin
  if tg_op = 'DELETE' then
    v_igreja := old.igreja_id; v_meses := array[to_char(old.data, 'YYYY-MM')];
  elsif tg_op = 'UPDATE' then
    -- mudar só a ligação (contribuinte, campanha, despesa fixa) não mexe no dinheiro do mês
    if (new.valor, new.data, new.tipo, new.fundo) is not distinct from (old.valor, old.data, old.tipo, old.fundo) then return new; end if;
    v_igreja := new.igreja_id; v_meses := array[to_char(old.data, 'YYYY-MM'), to_char(new.data, 'YYYY-MM')];
  else
    v_igreja := new.igreja_id; v_meses := array[to_char(new.data, 'YYYY-MM')];
  end if;
  if exists (select 1 from igreja.fechamentos f where f.igreja_id = v_igreja and f.mes = any(v_meses) and f.situacao = 'fechado') then
    raise exception 'mes fechado' using hint = 'Reabra o mês na tesouraria para mudar lançamentos dele.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists travar_mes_fechado on igreja.lancamentos;
create trigger travar_mes_fechado before insert or update or delete on igreja.lancamentos
  for each row execute function igreja.travar_mes_fechado();
