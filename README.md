# Guia Fissura Anal — PWA

Aplicativo PWA (informativo, saúde) com área de acesso paga: a pessoa compra na
**Hotmart**, recebe **e-mail + senha** e acessa o conteúdo por **6 meses**.

## Stack

- **Frontend:** PWA em HTML/CSS/JS puro (SPA, bottom-nav, offline via Service Worker)
- **Auth + acesso:** Supabase (Auth e-mail/senha + tabela `acessos` com validade)
- **Liberação:** Edge Function `hotmart-webhook` (cria usuário, gera senha, envia e-mail, trata reembolso)

## Estrutura

```
├── index.html / styles.css / app.js   app
├── config.js                          URL + anon key do Supabase + link de compra (preencher)
├── manifest.json / sw.js              PWA
├── vendor/supabase.js                 lib do Supabase embutida (offline)
├── icons/                             ícones da instalação
└── supabase/
    ├── schema.sql                     tabelas + RLS + função meu_acesso_valido()
    ├── functions/hotmart-webhook/     webhook da Hotmart
    ├── README.md                      passo a passo de configuração
    └── test/                          roteiro + payloads de teste
```

## Rodar local

```bash
python -m http.server 4599    # abre http://localhost:4599
```

Sem `config.js` preenchido, o app abre em **modo de visualização livre** (sem login).

## Próximos passos

1. Criar projeto Supabase, rodar `supabase/schema.sql`
2. Publicar a função (`supabase/README.md`)
3. Seguir `supabase/test/ROTEIRO-DE-TESTES.md`
4. Publicar o app e conectar a Hotmart (último passo)

> Conteúdo apenas informativo. Todo tratamento deve ser acompanhado por um médico especialista.
