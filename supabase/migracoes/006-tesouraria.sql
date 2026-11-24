-- =========================================================
-- 006 — Tesouraria: saídas (despesas) com categoria e descrição
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

alter table igreja.lancamentos drop constraint if exists lancamentos_tipo_check;
alter table igreja.lancamentos add  constraint lancamentos_tipo_check check (tipo in ('dizimo','oferta','outro','saida'));
alter table igreja.lancamentos add column if not exists categoria text;
alter table igreja.lancamentos add column if not exists descricao text;
create index if not exists lancamentos_igreja_tipo on igreja.lancamentos (igreja_id, tipo, data);
