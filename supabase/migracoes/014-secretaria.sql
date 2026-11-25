-- Secretaria: cargo próprio, dados do visitante e avisos/eventos da igreja

-- novo cargo
alter table igreja.equipe drop constraint if exists equipe_papel_check;
alter table igreja.equipe add constraint equipe_papel_check check (papel in ('admin','pastor','tesoureiro','obreiro','secretario','membro'));
alter table igreja.convites drop constraint if exists convites_papel_check;
alter table igreja.convites add constraint convites_papel_check check (papel in ('admin','pastor','tesoureiro','obreiro','secretario','membro'));

-- secretário(a) faz parte da equipe (vê pessoas, jornada, agenda); tesouraria continua só admin/pastor/tesoureiro
create or replace function igreja.sou_equipe(p_igreja uuid)
returns boolean language sql stable security definer set search_path = igreja as $$
  select exists (select 1 from igreja.equipe where igreja_id = p_igreja and user_id = auth.uid()
                 and papel in ('admin','pastor','tesoureiro','obreiro','secretario'));
$$;

-- como o visitante chegou
alter table igreja.pessoas add column if not exists primeira_visita date;
alter table igreja.pessoas add column if not exists como_conheceu text;
alter table igreja.pessoas add column if not exists convidado_por text;

-- avisos e eventos da igreja
create table if not exists igreja.avisos (
  id uuid primary key default gen_random_uuid(),
  igreja_id uuid not null references igreja.igrejas(id) on delete cascade,
  tipo text not null default 'evento' check (tipo in ('evento','aviso')),
  titulo text not null,
  texto text,
  data date,
  hora text,
  local text,
  ate date,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_igreja_data on igreja.avisos (igreja_id, data);
alter table igreja.avisos enable row level security;
grant select, insert, update, delete on igreja.avisos to authenticated;
create policy equipe on igreja.avisos for all
  using (igreja.sou_equipe(igreja_id)) with check (igreja.sou_equipe(igreja_id));
-- membros também leem (pra área do membro)
create policy ler on igreja.avisos for select using (igreja.sou_da_igreja(igreja_id));
