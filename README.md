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

## Estado atual

- [x] App PWA pronto e testado
- [x] `config.js` ligado ao Supabase (URL + `sb_publishable_...`)
- [x] Repositório no GitHub
- [ ] Rodar `supabase/schema.sql` no SQL Editor
- [ ] Publicar / servir a função `hotmart-webhook` + secrets
- [ ] Rodar `supabase/test/ROTEIRO-DE-TESTES.md`
- [ ] Publicar o app (subdomínio grátis) e conectar a Hotmart

> Conteúdo apenas informativo. Todo tratamento deve ser acompanhado por um médico especialista.
