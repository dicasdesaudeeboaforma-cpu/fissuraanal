# Roteiro de testes (antes de conectar a Hotmart)

Objetivo: validar login, liberação, expiração de 6 meses, reembolso e uso offline
**simulando o webhook na mão**. Só depois que tudo isso passar a gente pluga a Hotmart.

### Nada aqui precisa de domínio próprio

| Peça | Onde roda no teste | Domínio? |
|---|---|---|
| App PWA | `python -m http.server` no seu PC (`http://localhost:4599`) | não |
| Supabase (Auth + banco) | URL grátis `xxxx.supabase.co` | não |
| Edge Function | `xxxx.functions.supabase.co` **ou** 100% local (`supabase functions serve`) | não |
| E-mail (Resend) | opcional no teste — veja abaixo | só pra produção |
| Hotmart | último passo, usa a URL `.supabase.co` (não seu domínio) | não |

Quando for pro ar de verdade, um subdomínio grátis (Netlify/Vercel/Cloudflare Pages,
tipo `seuapp.netlify.app`) já serve. Domínio próprio é só estética.

### Pré-requisitos

Projeto Supabase criado, [`schema.sql`](../schema.sql) rodado, função `hotmart-webhook`
publicada (ou servida localmente), e um Hottok de teste:
`supabase secrets set HOTMART_HOTTOK="teste123"`.

**E-mail é opcional para testar.** Se você **não** definir `RESEND_API_KEY`, a função
não envia e-mail e **devolve a senha gerada no corpo da resposta** (`"senha_teste": "..."`),
para você conseguir logar. Quando `RESEND_API_KEY` existir, a senha some da resposta e vai
só por e-mail (comportamento de produção).

Guarde os valores:

```
FUNC_URL=https://SEU_REF.functions.supabase.co/hotmart-webhook
HOTTOK=teste123
```

---

## 1. Compra aprovada → cria usuário + 6 meses + e-mail

**bash / git-bash:**
```bash
curl -i -X POST "$FUNC_URL" \
  -H "Content-Type: application/json" \
  -H "X-HOTMART-HOTTOK: $HOTTOK" \
  --data @payload-aprovada.json
```

**PowerShell:**
```powershell
curl.exe -i -X POST "$env:FUNC_URL" `
  -H "Content-Type: application/json" `
  -H "X-HOTMART-HOTTOK: $env:HOTTOK" `
  --data "@payload-aprovada.json"
```

Esperado (sem `RESEND_API_KEY`, modo teste):
- resposta `200` com `{"ok":true,"acao":"liberado","email":"...","expira_em":"...","email_enviado":false,"senha_teste":"XXXXXXXX"}`
- **anote a `senha_teste`** — é com ela que você loga no passo 2
- **Supabase → Authentication → Users**: usuário `comprador.teste@exemplo.com` criado (confirmado)
- **Supabase → Table Editor → acessos**: 1 linha, `status = ativo`, `expira_em` ≈ hoje + 6 meses
- rode o mesmo comando 2x: **não** pode duplicar linha nem dar erro (upsert por `user_id`);
  na 2ª vez a `senha_teste` muda (a senha do usuário é redefinida)

> Com `RESEND_API_KEY` configurada: `email_enviado: true`, **sem** `senha_teste`, e o e-mail
> chega com a senha. Sem domínio verificado na Resend, o envio só funciona para o e-mail
> da sua própria conta Resend — então use esse endereço no `payload-aprovada.json`.

## 2. Login no app

1. `fissura-app/config.js` → preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
2. Sirva o app: dentro de `fissura-app/` → `python -m http.server 4599`
3. Abra `http://localhost:4599`, faça login com o e-mail do teste + a senha do e-mail.

Esperado:
- entra no guia, aparece o selo `~180d` no topo (verde)
- **Minha conta** (botão do topo) mostra e-mail + "Acesso ativo • X dias restantes (até ...)"

## 3. Trocar senha

Em **Minha conta → Trocar senha**, digite uma nova (≥6), salvar → "Senha atualizada com sucesso!".
Saia e entre de novo com a senha nova.

## 4. Aviso de expiração próxima

No **SQL Editor**:
```sql
update public.acessos
set expira_em = now() + interval '10 days'
where email = 'comprador.teste@exemplo.com';
```
Recarregue o app → selo do topo fica **amarelo** e "10 dias restantes".

## 5. Acesso expirado

```sql
update public.acessos
set expira_em = now() - interval '1 day'
where email = 'comprador.teste@exemplo.com';
```
Recarregue → tela **"Seu acesso expirou"** com botão "Renovar acesso" (link do `COMPRA_URL`).
Login continua funcionando, mas o conteúdo fica bloqueado.

Volte para ativo:
```sql
update public.acessos
set expira_em = now() + interval '6 months', status = 'ativo'
where email = 'comprador.teste@exemplo.com';
```

## 6. Reembolso / chargeback

```bash
curl -i -X POST "$FUNC_URL" \
  -H "Content-Type: application/json" \
  -H "X-HOTMART-HOTTOK: $HOTTOK" \
  --data @payload-reembolso.json
```
Esperado: `acao: revogado`, `status: reembolsado` na tabela; app mostra **"Acesso cancelado"**.

## 7. Hottok inválido (segurança)

```bash
curl -i -X POST "$FUNC_URL" -H "Content-Type: application/json" \
  -H "X-HOTMART-HOTTOK: errado" --data @payload-aprovada.json
```
Esperado: `401 unauthorized` e **nada** gravado.

## 8. Uso offline

1. Com acesso ativo, abra o app online uma vez (para salvar o snapshot).
2. DevTools → Network → **Offline** → recarregue → o guia abre normalmente.
3. Simule expiração offline: no console
   ```js
   var s = JSON.parse(localStorage.fa_access_snapshot_v1);
   s.expira_em = new Date(Date.now() - 86400000).toISOString();
   localStorage.fa_access_snapshot_v1 = JSON.stringify(s);
   ```
   Recarregue (ainda offline) → tela de bloqueio.

## 9. Logout

**Minha conta → Sair** → volta para a tela de login; recarregar não entra sozinho.

---

## Testar a função localmente (opcional, sem deploy)

```bash
supabase start
supabase functions serve hotmart-webhook --no-verify-jwt --env-file supabase/.env.local
# noutro terminal:
curl -i -X POST "http://localhost:54321/functions/v1/hotmart-webhook" \
  -H "Content-Type: application/json" -H "X-HOTMART-HOTTOK: teste123" \
  --data @supabase/test/payload-aprovada.json
```

`supabase/.env.local` (não versionar):
```
HOTMART_HOTTOK=teste123
RESEND_API_KEY=re_xxx
EMAIL_FROM=Acesso <onboarding@resend.dev>
APP_URL=http://localhost:4599
ACCESS_MONTHS=6
```

---

## Só depois de tudo acima passar: conectar a Hotmart

1. Hotmart → Ferramentas → Webhook → nova configuração.
2. URL = `FUNC_URL`, versão 2.0.0.
3. Eventos: **Compra aprovada/completa**, **Compra reembolsada**, **Chargeback**, **Compra cancelada**.
4. Copie o **Hottok real** → `supabase secrets set HOTMART_HOTTOK="<hottok real>"` → `supabase functions deploy hotmart-webhook --no-verify-jwt`.
5. Use "Testar webhook" da Hotmart e confira em **Edge Functions → Logs**.
6. Faça uma compra real de teste (cupom 100% ou valor mínimo) e valide o e-mail + login.
7. Peça reembolso dessa compra de teste e confirme o bloqueio.
