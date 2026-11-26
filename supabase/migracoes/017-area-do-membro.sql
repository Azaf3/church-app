-- =========================================================
-- 017 — Área do membro: "Vou participar", pedidos de oração e pedidos de visita/conversa
-- * confirmacoes: quem vai a cada evento (o membro marca; a equipe vê os nomes; todos veem o total)
-- * pedidos: oração (só pros pastores ou no mural da igreja) e visita/conversa com o pastor
-- * intercessoes: "Estou orando" nos pedidos do mural (todos veem o total)
-- Quem vê o quê:
--   oração só pros pastores -> quem tem cargo de pastor (papel pastor ou cargo "Pastor")
--   oração no mural         -> toda a igreja
--   visita e conversa       -> pastores, administrador, obreiros e secretaria
-- Seguro pra rodar de novo.
-- =========================================================

-- Quem conta como pastor: papel pastor ou cargo "Pastor/Pastora" (ex.: pastor com acesso de administrador).
-- Se a igreja ainda não tem nenhum pastor marcado (nem num acesso já liberado), o administrador faz esse papel.
create or replace function igreja.sou_pastor(p_igreja uuid)
returns boolean language sql stable security definer set search_path = igreja as $$
  select exists (select 1 from igreja.equipe where igreja_id = p_igreja and user_id = auth.uid()
                   and (papel = 'pastor' or coalesce(titulo, '') ilike '%pastor%'))
      or (exists (select 1 from igreja.equipe where igreja_id = p_igreja and user_id = auth.uid() and papel = 'admin')
          and not exists (select 1 from igreja.equipe where igreja_id = p_igreja and (papel = 'pastor' or coalesce(titulo, '') ilike '%pastor%'))
          and not exists (select 1 from igreja.convites where igreja_id = p_igreja and (papel = 'pastor' or coalesce(titulo, '') ilike '%pastor%')));
$$;

-- quem cuida dos pedidos de visita e conversa
create or replace function igreja.cuido_de_pedidos(p_igreja uuid)
returns boolean language sql stable security definer set search_path = igreja as $$
  select igreja.sou_pastor(p_igreja) or igreja.tenho_papel(p_igreja, array['admin','pastor','obreiro','secretario']);
$$;

-- ---------- "Vou participar" ----------
create table if not exists igreja.confirmacoes (
  aviso_id uuid not null references igreja.avisos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  nome text,
  criado_em timestamptz not null default now(),
  primary key (aviso_id, user_id)
);
alter table igreja.confirmacoes enable row level security;
grant select, insert, delete on igreja.confirmacoes to authenticated;
drop policy if exists minha on igreja.confirmacoes;
create policy minha on igreja.confirmacoes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and igreja.sou_da_igreja(igreja_id)
              and exists (select 1 from igreja.avisos a where a.id = confirmacoes.aviso_id and a.igreja_id = confirmacoes.igreja_id));
drop policy if exists equipe_ve on igreja.confirmacoes;
create policy equipe_ve on igreja.confirmacoes for select using (igreja.sou_equipe(igreja_id));

-- o nome vem do cadastro de quem confirmou (não do que o navegador manda)
create or replace function igreja.autor_confirmacao()
returns trigger language plpgsql security definer set search_path = igreja as $$
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  select coalesce(p.nome, e.nome) into new.nome
    from igreja.equipe e left join igreja.pessoas p on p.id = e.pessoa_id
   where e.igreja_id = new.igreja_id and e.user_id = new.user_id;
  return new;
end $$;
drop trigger if exists autor on igreja.confirmacoes;
create trigger autor before insert on igreja.confirmacoes for each row execute function igreja.autor_confirmacao();

-- total de confirmados por evento (qualquer um da igreja vê o número)
create or replace function igreja.confirmados(p_igreja uuid)
returns table (aviso_id uuid, total int) language sql stable security definer set search_path = igreja as $$
  select c.aviso_id, count(*)::int from igreja.confirmacoes c
   where c.igreja_id = p_igreja and igreja.sou_da_igreja(p_igreja)
   group by c.aviso_id;
$$;

-- ---------- Pedidos (oração, visita, conversa) ----------
create table if not exists igreja.pedidos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pessoa_id uuid references igreja.pessoas(id) on delete set null,
  nome text,
  tipo text not null check (tipo in ('oracao','visita','conversa')),
  texto text,
  publico boolean not null default false,   -- oração: a igreja toda pode orar junto (mural)
  quando text,                              -- visita/conversa: melhor dia e horário pra pessoa
  status text not null default 'aberto' check (status in ('aberto','orando','agendado','respondido','feito')),
  resposta text,                            -- testemunho ("Deus respondeu")
  atendido_por text,                        -- quem da equipe está orando / vai visitar
  marcado_para timestamptz,                 -- visita/conversa marcada na agenda
  agenda_id uuid references igreja.agenda(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_igreja on igreja.pedidos (igreja_id, criado_em desc);
alter table igreja.pedidos enable row level security;
grant select, insert, update, delete on igreja.pedidos to authenticated;

drop policy if exists ver on igreja.pedidos;
create policy ver on igreja.pedidos for select using (
  user_id = auth.uid()
  or (tipo = 'oracao' and publico and igreja.sou_da_igreja(igreja_id))
  or (tipo = 'oracao' and igreja.sou_pastor(igreja_id))
  or (tipo <> 'oracao' and igreja.cuido_de_pedidos(igreja_id))
);
drop policy if exists criar on igreja.pedidos;
create policy criar on igreja.pedidos for insert
  with check (user_id = auth.uid() and igreja.sou_da_igreja(igreja_id));
drop policy if exists mudar on igreja.pedidos;
create policy mudar on igreja.pedidos for update
  using (user_id = auth.uid()
         or (tipo = 'oracao' and igreja.sou_pastor(igreja_id))
         or (tipo <> 'oracao' and igreja.cuido_de_pedidos(igreja_id)))
  with check (igreja.sou_da_igreja(igreja_id)
              and (user_id = auth.uid()
                   or (tipo = 'oracao' and igreja.sou_pastor(igreja_id))
                   or (tipo <> 'oracao' and igreja.cuido_de_pedidos(igreja_id))));
drop policy if exists apagar on igreja.pedidos;
create policy apagar on igreja.pedidos for delete
  using (user_id = auth.uid() or igreja.sou_pastor(igreja_id) or igreja.tenho_papel(igreja_id, array['admin']));

-- quem pediu e a ficha vêm do cadastro; todo pedido novo começa "aberto"
create or replace function igreja.autor_pedido()
returns trigger language plpgsql security definer set search_path = igreja as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then new.user_id := auth.uid(); end if;
    select coalesce(p.nome, e.nome), e.pessoa_id into new.nome, new.pessoa_id
      from igreja.equipe e left join igreja.pessoas p on p.id = e.pessoa_id
     where e.igreja_id = new.igreja_id and e.user_id = new.user_id;
    new.status := 'aberto';
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists autor on igreja.pedidos;
create trigger autor before insert or update on igreja.pedidos for each row execute function igreja.autor_pedido();

-- ---------- "Estou orando" nos pedidos do mural ----------
create table if not exists igreja.intercessoes (
  pedido_id uuid not null references igreja.pedidos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (pedido_id, user_id)
);
alter table igreja.intercessoes enable row level security;
grant select, insert, delete on igreja.intercessoes to authenticated;
drop policy if exists minha on igreja.intercessoes;
create policy minha on igreja.intercessoes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and igreja.sou_da_igreja(igreja_id)
              and exists (select 1 from igreja.pedidos p where p.id = intercessoes.pedido_id and p.igreja_id = intercessoes.igreja_id));

create or replace function igreja.intercessores(p_igreja uuid)
returns table (pedido_id uuid, total int) language sql stable security definer set search_path = igreja as $$
  select i.pedido_id, count(*)::int from igreja.intercessoes i
   where i.igreja_id = p_igreja and igreja.sou_da_igreja(p_igreja)
   group by i.pedido_id;
$$;

grant execute on function igreja.sou_pastor(uuid), igreja.cuido_de_pedidos(uuid), igreja.confirmados(uuid), igreja.intercessores(uuid) to authenticated;

select 'pronto' as migracao_017;
