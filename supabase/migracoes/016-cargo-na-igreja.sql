-- =========================================================
-- 016 — Cargo na igreja (título) separado do acesso
-- * equipe.titulo / convites.titulo: como a pessoa aparece (Pastor, Diácono, Missionária…),
--   independente do nível de acesso (papel). Ex.: Gildazio = Pastor com acesso de administrador.
-- * aceitar_convites leva o título junto no primeiro login.
-- * Gildazio já fica ligado à ficha dele, como Pastor e administrador.
-- * A conta só de desenvolvimento (azaf3@dev.com) aparece como Desenvolvedor,
--   pra não ser sugerida como quem assina os documentos.
-- Seguro pra rodar de novo.
-- =========================================================

alter table igreja.equipe add column if not exists titulo text;
alter table igreja.convites add column if not exists titulo text;

create or replace function igreja.aceitar_convites()
returns int language plpgsql security definer set search_path = igreja as $$
declare v_email text; v_qtd int;
begin
  if not igreja.email_comprovado() then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return 0; end if;
  insert into igreja.equipe (igreja_id, user_id, nome, papel, pessoa_id, titulo)
    select c.igreja_id, auth.uid(), c.nome, c.papel, c.pessoa_id, c.titulo from igreja.convites c
    where lower(c.email) = v_email
  on conflict (igreja_id, user_id) do update
    set papel = excluded.papel,
        pessoa_id = coalesce(excluded.pessoa_id, igreja.equipe.pessoa_id),
        titulo = coalesce(excluded.titulo, igreja.equipe.titulo);
  get diagnostics v_qtd = row_count;
  delete from igreja.convites where lower(email) = v_email;
  return v_qtd;
end $$;
grant execute on function igreja.aceitar_convites() to authenticated;

-- Gildazio: pastor da igreja, entra como administrador e já cai na ficha dele
update igreja.convites c
   set papel = 'admin',
       titulo = 'Pastor',
       pessoa_id = coalesce(c.pessoa_id, f.id),
       nome = coalesce(f.nome, c.nome)
  from (select p.id, p.nome, p.igreja_id, lower(p.email) email from igreja.pessoas p
         where p.ativo and lower(p.email) = 'amigodefe@gmail.com'
         order by p.criado_em limit 1) f
 where lower(c.email) = 'amigodefe@gmail.com' and f.igreja_id = c.igreja_id;

update igreja.equipe e set titulo = 'Desenvolvedor'
 where e.titulo is null and e.user_id in (select id from auth.users where lower(email) = 'azaf3@dev.com');

select 'convite' de, nome, papel, titulo, (pessoa_id is not null) com_ficha from igreja.convites
union all
select 'equipe', nome, papel, titulo, (pessoa_id is not null) from igreja.equipe
order by 1, 2;
