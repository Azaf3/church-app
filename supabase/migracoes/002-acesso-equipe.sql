-- =========================================================
-- 002 — Liga login da equipe a uma pessoa da igreja
-- (ex.: Gildazio é membro e também pastor)
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

alter table igreja.equipe   add column if not exists pessoa_id uuid references igreja.pessoas(id) on delete set null;
alter table igreja.convites add column if not exists pessoa_id uuid references igreja.pessoas(id) on delete set null;

-- uma pessoa só pode estar ligada a um login por igreja
create unique index if not exists equipe_pessoa_unica on igreja.equipe (igreja_id, pessoa_id) where pessoa_id is not null;

-- aceitar convite agora também leva o vínculo com a pessoa
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

grant execute on function igreja.aceitar_convites() to authenticated;
