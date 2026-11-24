# Pastoreio — gestão pastoral pra igrejas

Web app (React + Vite + TypeScript + Supabase), mobile-first e instalável como PWA.
Multi-igreja: cada igreja só enxerga os próprios dados (garantido por RLS no banco).
Primeira igreja: **Igreja Cristã Esperança**.

## O que tem

| Tela | O que faz |
|---|---|
| **Hoje** | Pessoas sob seu cuidado com próximo passo e prazo, agenda do dia, quem faltou no último culto, aniversários da semana — tudo com botão de WhatsApp |
| **Pessoas** | Membros e visitantes, busca, ficha com histórico de cuidado e "Registrar contato" |
| **Jornada** | Kanban Novo → Relacionamento → Integração → Membresia → Pequeno grupo, com "Avançar" |
| **Agenda** | Visitas, culto no lar, aconselhamento; da equipe ou só minha |
| **Presença** | Chamada por culto e lista de quem faltou com mensagem pronta |
| **Dízimos e ofertas** | Lançamentos por mês, totais. Só admin, pastor e tesoureiro |
| **Aniversariantes** | Por mês, com parabéns pelo WhatsApp |
| **Equipe** | Convite por e-mail com função (obreiro, tesoureiro, pastor) |
| **Importar fichas** | Lê o CSV de respostas do Google Forms, junta respostas repetidas e corrige datas/telefones |

## Configurar

1. **Banco** — no Supabase, abra o SQL Editor e rode `supabase/schema.sql` inteiro.
   Ele apaga e recria só o schema `igreja`, então pode rodar de novo sem erro.
   Tudo fica no schema `igreja`, então dá pra usar um projeto Supabase que você já tem.
2. **Expor o schema** — Settings → API → *Exposed schemas* → adicione `igreja`.
3. **Variáveis** — copie `.env.example` pra `.env` e coloque a URL e a anon key do projeto.
4. **Rodar**
   ```bash
   npm install
   npm run dev
   ```
5. Crie sua conta, cadastre a igreja (você vira admin) e convide a equipe pelo e-mail.

> Pra testes, em Authentication → Providers → Email dá pra desligar "Confirm email".

## Demo sem servidor

```bash
npm run build:demo
```

Gera `dist-demo/index.html`: o app inteiro num arquivo só, com dados de exemplo em memória
(não precisa de Supabase). Bom pra mostrar pra uma igreja antes de configurar.

## Deploy

Vercel ou Netlify: importa o repo, coloca as duas variáveis `VITE_...` e pronto.
Como usa rotas (`/pessoas`, `/agenda`), configure o fallback pra `index.html`
(na Vercel é automático pra Vite; na Netlify, crie `public/_redirects` com `/*  /index.html  200`).

## Funções

- **admin** — quem criou a igreja. Acesso total.
- **pastor** — acesso total, gerencia equipe.
- **tesoureiro** — pessoas, agenda, presença + financeiro.
- **obreiro** — pessoas, jornada, agenda, presença. Não vê financeiro.

## Próximos passos possíveis

- Cobrança por igreja (plano/assinatura) pra vender como produto
- Relatório mensal em PDF (financeiro + presença)
- Ficha de visitante por QR code na recepção
- Lembrete automático de aniversário e de prazo vencido
