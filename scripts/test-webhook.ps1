<#
  Simula uma notificacao da Hotmart contra a Edge Function.
  Compativel com Windows PowerShell 5.1 e PowerShell 7+.

  Uso:
    powershell -File scripts/test-webhook.ps1 aprovada
    powershell -File scripts/test-webhook.ps1 reembolso
    powershell -File scripts/test-webhook.ps1 aprovada -FuncUrl "https://xxx.functions.supabase.co/hotmart-webhook" -Hottok "teste123"

  Sem -FuncUrl / -Hottok, usa as variaveis de ambiente FUNC_URL e HOTTOK.
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
    -Headers @{ "X-HOTMART-HOTTOK" = $Hottok } -UseBasicParsing
  Write-Host "HTTP $($resp.StatusCode)" -ForegroundColor Green
  $resp.Content
}
catch [System.Net.WebException] {
  $r = $_.Exception.Response
  if ($r) {
    $code = [int]$r.StatusCode
    $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
    $text = $sr.ReadToEnd()
    Write-Host "HTTP $code" -ForegroundColor Yellow
    $text
  } else {
    Write-Host "Sem resposta: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}
catch {
  Write-Host "Falhou: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
