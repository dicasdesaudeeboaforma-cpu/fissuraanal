<#
  Simula uma notificação da Hotmart contra a Edge Function.

  Uso:
    pwsh -File scripts/test-webhook.ps1 aprovada
    pwsh -File scripts/test-webhook.ps1 reembolso
    pwsh -File scripts/test-webhook.ps1 aprovada -FuncUrl "https://xxx.functions.supabase.co/hotmart-webhook" -Hottok "teste123"

  Sem -FuncUrl / -Hottok, usa as variáveis de ambiente FUNC_URL e HOTTOK.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet("aprovada", "reembolso")]
  [string]$Evento,
  [string]$FuncUrl = $env:FUNC_URL,
  [string]$Hottok  = $env:HOTTOK
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not $FuncUrl) { throw "Defina -FuncUrl ou a variavel de ambiente FUNC_URL" }
if (-not $Hottok)  { throw "Defina -Hottok ou a variavel de ambiente HOTTOK" }

$payloadFile = Join-Path $root "supabase/test/payload-$Evento.json"
if (-not (Test-Path $payloadFile)) { throw "Arquivo nao encontrado: $payloadFile" }
$body = Get-Content $payloadFile -Raw

Write-Host "POST $FuncUrl  (evento: $Evento)" -ForegroundColor Cyan
try {
  $resp = Invoke-WebRequest -Uri $FuncUrl -Method Post -Body $body `
    -ContentType "application/json" `
    -Headers @{ "X-HOTMART-HOTTOK" = $Hottok } `
    -SkipHttpErrorCheck
  Write-Host "HTTP $($resp.StatusCode)" -ForegroundColor Yellow
  $resp.Content
} catch {
  Write-Host "Falhou: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
