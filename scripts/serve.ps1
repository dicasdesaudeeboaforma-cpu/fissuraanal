<#
  Sobe um servidor estático da raiz do projeto em http://localhost:4599
  Uso:  pwsh -File scripts/serve.ps1  [-Port 4599]
#>
param([int]$Port = 4599)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Servindo $root em http://localhost:$Port  (Ctrl+C para parar)" -ForegroundColor Cyan

$py = Get-Command python -ErrorAction SilentlyContinue
if ($py) {
  python -m http.server $Port
  return
}

$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($npx) {
  npx --yes serve -l $Port .
  return
}

# Fallback: servidor mínimo em .NET (sem dependências)
Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
$mime = @{ ".html"="text/html"; ".css"="text/css"; ".js"="application/javascript";
           ".json"="application/json"; ".png"="image/png"; ".svg"="image/svg+xml";
           ".webmanifest"="application/manifest+json" }
try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $rel  = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($mime.ContainsKey($ext)) { $ctx.Response.ContentType = $mime[$ext] }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
}
