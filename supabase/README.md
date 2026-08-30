# Backend do Guia — Supabase + Hotmart

Fluxo: **compra aprovada na Hotmart → webhook → cria usuário com senha gerada → e-mail com login → acesso liberado por 6 meses**.

---

## 1. Criar o projeto Supabase

1. Crie um projeto em <https://supabase.com>.
2. Em **Project Settings → API**, copie:
   - `Project URL` → vai em `fissura/config.js` (`SUPABASE_URL`)
   - `anon public` key → vai em `fissura/config.js` (`SUPABASE_ANON_KEY`)
   - `service_role` key → **NÃO** vai no front. Só é usada pela Edge Function (já fica disponível como secret padrão).

## 2. Criar as tabelas

Abra **SQL Editor → New query**, cole todo o conteúdo de [`schema.sql`](./schema.sql) e clique em **Run**.

Isso cria:
- tabela `public.acessos` (uma linha por comprador, com `expira_em`);
- RLS: cada pessoa só lê a própria linha;
- função `meu_acesso_valido()` que o app chama para saber se libera o conteúdo.

## 3. Configurar o envio de e-mail (Resend)

1. Crie conta em <https://resend.com> e gere uma **API Key**.
2. (Recomendado) verifique seu domínio para enviar de `acesso@seudominio.com.br`.
   Sem domínio verificado, use `onboarding@resend.dev` só para teste.

## 4. Publicar a Edge Function

Instale a CLI: <https://supabase.com/docs/guides/cli>

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF

# segredos usados pela função
supabase secrets set HOTMART_HOTTOK="o-token-do-webhook-da-hotmart"
supabase secrets set RESEND_API_KEY="re_xxxxxxxx"
supabase secrets set EMAIL_FROM="Guia Fissura <acesso@seudominio.com.br>"
supabase secrets set APP_URL="https://seuapp.com"
supabase secrets set ACCESS_MONTHS="6"

# deploy (sem verificação de JWT: quem autentica é o Hottok)
supabase functions deploy hotmart-webhook --no-verify-jwt
```

A URL final fica assim:
```
https://SEU_PROJECT_REF.functions.supabase.co/hotmart-webhook
```

## 5. Configurar o Webhook na Hotmart

Em **Hotmart → Ferramentas → Webhook (Notificações)**:

- **URL**: a URL da função acima
- **Versão**: 2.0.0 (a função também aceita o formato antigo)
- **Eventos**:
  - `Compra aprovada` / `Compra completa` → libera acesso
  - `Compra reembolsada`, `Chargeback`, `Compra cancelada` → revoga acesso
- Copie o **Hottok** gerado e use no `supabase secrets set HOTMART_HOTTOK=...`

Use o botão **"Testar webhook"** da Hotmart para validar. O log aparece em
**Supabase → Edge Functions → hotmart-webhook → Logs**.

## 6. Ligar o front

Em `fissura/config.js` preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `COMPRA_URL`
(link do checkout da Hotmart, usado no botão "Renovar acesso").

Enquanto `config.js` não estiver preenchido, o app abre em **modo de visualização livre**
(sem login) — útil para revisar o layout.

---

## Comportamento do acesso

| Situação | O que o usuário vê |
|---|---|
| Sem login | Tela de login |
| Login OK + `expira_em` no futuro | Guia completo + selo "Xd" no topo |
| Faltando ≤ 15 dias | Selo de dias fica amarelo |
| `expira_em` no passado | Tela "Seu acesso expirou" + botão renovar |
| Reembolso / chargeback | Tela "Acesso cancelado" |
| Offline após já ter entrado | Guia continua funcionando até a data de expiração (snapshot local) |

## Observação sobre conteúdo offline

O texto do guia faz parte do app (cache do Service Worker) para funcionar sem internet.
Isso significa que o conteúdo é, tecnicamente, extraível do cache do dispositivo por
usuários avançados — padrão em áreas de membros com modo offline. O portão de login e o
prazo de 6 meses são revalidados a cada abertura com internet.

Para um bloqueio mais forte, o conteúdo pode ser entregue por uma segunda Edge Function
autenticada (`get-content`) que só responde com JWT válido + acesso ativo, guardando o
resultado em `localStorage` com a data de expiração. Peça se quiser essa versão.
