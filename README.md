# Guia Fissura Anal — PWA + página de vendas

Aplicativo PWA (informativo, saúde) com área de acesso paga: a pessoa compra na
**Hotmart**, recebe **e-mail + senha** e acessa o conteúdo por **6 meses**.

- Repositório: <https://github.com/dicasdesaudeeboaforma-cpu/fissuraanal>
- Projeto Supabase: `wejgiterhfxqelpzhzki` (`https://wejgiterhfxqelpzhzki.supabase.co`)
- Domínio planejado: `fissuraanal.dicasdesaudeeboaforma.com.br`
  - `/` → página de vendas (`index.html` na raiz)
  - `/fissura/` → o app (pasta `fissura/`)

## Stack

- **Frontend:** PWA em HTML/CSS/JS puro (SPA, bottom-nav, offline via Service Worker)
- **Auth + acesso:** Supabase (Auth e-mail/senha + tabela `acessos` com validade)
- **Liberação:** Edge Function `hotmart-webhook` (cria usuário, gera senha, envia e-mail, trata reembolso)

## Estrutura

```
fissuraanal/
├── index.html                          página de vendas (raiz do domínio)
├── fissura/
│   ├── index.html / styles.css / app.js   o app (PWA)
│   ├── config.js                          URL + chave pública do Supabase + link de compra
│   ├── manifest.json / sw.js              PWA
│   ├── vendor/supabase.js                 lib do Supabase embutida (funciona offline)
│   └── icons/                             ícones da instalação
├── scripts/
│   ├── serve.ps1                       sobe tudo em http://localhost:4599
│   ├── test-webhook.ps1               simula a notificação da Hotmart
│   └── create-test-user.ps1           cria/libera um usuário de teste direto no Supabase
├── .vscode/                           tasks + extensões recomendadas
└── supabase/
    ├── schema.sql                      tabelas + RLS + função meu_acesso_valido()
    ├── functions/hotmart-webhook/      webhook da Hotmart (Deno)
    ├── .env.local.example              modelo de variáveis para rodar a função local
    ├── README.md                       passo a passo de configuração
    └── test/                           roteiro + payloads de teste
```

Local: página de vendas em <http://localhost:4599/>, app em <http://localhost:4599/fissura/>.

## Trabalhando no VS Code + PowerShell

Abra a pasta:

```powershell
code C:\Users\diret\OneDrive\Documentos\fissuraanal
```

O VS Code vai sugerir as extensões de `.vscode/extensions.json` (Deno para
`supabase/functions`, PowerShell, Supabase, Live Server). Aceite.

### Rodar o app localmente

```powershell
powershell -File scripts/serve.ps1
```

ou **Terminal → Run Task → "app: servir local (porta 4599)"**.
Abre em <http://localhost:4599>. Usa `python` se existir, senão `npx serve`, senão um
servidor .NET embutido (sem instalar nada).

### Simular a Hotmart (depois que a função estiver no ar ou servida local)

```powershell
$env:FUNC_URL = "https://wejgiterhfxqelpzhzki.functions.supabase.co/hotmart-webhook"
$env:HOTTOK   = "teste123"
powershell -File scripts/test-webhook.ps1 aprovada
powershell -File scripts/test-webhook.ps1 reembolso
```

## Estado atual (atualizado 2026-09-13)

- [x] App PWA pronto e testado
- [x] `config.js` ligado ao Supabase (URL + `sb_publishable_...`)
- [x] Repositório no GitHub, branch `main` atualizada e organizada (raiz = vendas, `/fissura` = app)
- [x] **Publicado no GitHub Pages** (NÃO Vercel — projeto Vercel criado por engano na conta do Tarifly foi removido): https://dicasdesaudeeboaforma-cpu.github.io/fissuraanal/
- [x] **Domínio próprio no ar**: http://fissuraanal.dicasdesaudeeboaforma.com.br/ (DNS na Cloudflare, `CNAME fissuraanal -> dicasdesaudeeboaforma-cpu.github.io`, DNS only). HTTPS deve ativar sozinho em breve (certificado automático do GitHub).
- [x] Conta Supabase confirmada: mesma org `dicasdesaudeeboaforma-cpu` (login provavelmente via GitHub OAuth). Access token gerado em Account → Access Tokens, escopo restrito ao projeto.
- [x] Projeto Supabase estava **pausado** (plano free) — reativado via API (`POST /v1/projects/{ref}/restore`)
- [x] `schema.sql` executado com sucesso (tabela `acessos`, RLS, função `meu_acesso_valido()`, trigger) — rodado via Management API (`POST /v1/projects/{ref}/database/query`), sem precisar do SQL Editor manualmente
- [x] Edge Function `hotmart-webhook` publicada (`supabase functions deploy hotmart-webhook --no-verify-jwt`)
- [x] Secrets configurados: `HOTMART_HOTTOK=teste123` (placeholder de teste), `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`
- [x] **Fluxo completo testado de ponta a ponta**: webhook cria usuário → libera 6 meses → login funciona → conteúdo aparece com contador de dias restantes
- [x] Domínio `dicasdesaudeeboaforma.com.br` verificado na Resend (SPF+DKIM+DMARC configurados na Cloudflare) — e-mail sai do domínio próprio, não mais do sandbox `resend.dev`
- [x] Corrigido problema de e-mail caindo em spam: assunto/remetente continham "Fissura Anal" explicitamente, o que acionava filtro de conteúdo sensível — trocado pra "Acesso ao Guia" / "Seu acesso foi liberado ✅" (também mais alinhado à discrição que é a proposta do produto)
- [x] **Confirmado**: com assunto/remetente neutros, o e-mail chega na caixa principal do Gmail (não spam)
- [ ] Trocar `HOTMART_HOTTOK` de teste pelo token real quando conectar a Hotmart de verdade
- [ ] Rodar o roteiro de testes formal (`supabase/test/ROTEIRO-DE-TESTES.md`) — o core já foi validado manualmente
- [ ] Conectar a Hotmart de verdade (último passo, por decisão do usuário)

### Credenciais/tokens usados nesta sessão (não commitados, guardar em local seguro)
- Supabase access token (projeto-scoped): gerado pelo usuário, usado via `SUPABASE_ACCESS_TOKEN` nas chamadas da CLI/API — **não salvo em nenhum arquivo do repo**
- Resend API key: configurada como secret da Edge Function via `supabase secrets set` — **não salva em nenhum arquivo do repo**

> Conteúdo apenas informativo. Todo tratamento deve ser acompanhado por um médico especialista.
