-- =========================================================
-- 003 — Identidade visual de cada igreja (cor e logo)
-- Seguro pra rodar com dados: não apaga nada e pode rodar de novo.
-- =========================================================

alter table igreja.igrejas add column if not exists cor text not null default '#1f5c4c'
  check (cor ~ '^#[0-9a-fA-F]{6}$');
alter table igreja.igrejas add column if not exists logo text
  check (logo is null or (logo like 'data:image/%' and length(logo) < 300000));
