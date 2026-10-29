# Code Battle Lite - PowerShell static server with live reload
# .\server.ps1 -Port 8788
param(
  [ValidateRange(1024,65535)][int]$Port = 8765,
  [switch]$NoBrowser,
  [string]$Root = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath($Root)
$Required = @('index.html','css/inicio.css','shared/js/iconos.js','shared/js/estructura.js',
              'shared/js/edicion.js','Prototypes/Tres vistas/index.html','Prototypes/Rocket Launcher/index.html')
$Missing = @($Required | Where-Object { -not [IO.File]::Exists((Join-Path $Root $_)) })
if ($Missing.Count -gt 0) {
  Write-Host "Server root: $Root" -ForegroundColor Yellow
  Write-Host 'Required files are missing:' -ForegroundColor Red
  $Missing | ForEach-Object { Write-Host "  - $_" }
  throw 'Serve the complete Code-battle-lite folder: the home page, Prototypes and shared are required.'
}
$RootPrefix = $Root.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
$Url = "http://localhost:$Port/"
$Mime = @{
 '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'
 '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8'
 '.mjs'='text/javascript; charset=utf-8'; '.json'='application/json; charset=utf-8'
 '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'
 '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp'
 '.ico'='image/x-icon'; '.woff'='font/woff'; '.woff2'='font/woff2'
 '.ttf'='font/ttf'; '.wasm'='application/wasm'; '.map'='application/json'
}
$Live = @'
<script data-code-battle-lite-live>
(() => {
  let last = null;
  async function check() {
    try {
      const r = await fetch('/__live_version', {cache:'no-store'});
      if (!r.ok) return;
      const next = await r.text();
      if (last !== null && last !== next) location.reload();
      last = next;
    } catch (_) {}
  }
  check(); setInterval(check, 1200);
})();
</script>
'@
function Get-Version {
  $latest = 0L; $count = 0
  Get-ChildItem -LiteralPath $Root -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Extension -in @('.html','.htm','.css','.js','.json','.svg','.png','.jpg','.jpeg','.webp','.wasm') -and
      $_.FullName -notmatch '[\\/](node_modules|\.git|dist|educational-animation|pruebas)[\\/]'
    } | ForEach-Object {
      $count++
      if ($_.LastWriteTimeUtc.Ticks -gt $latest) { $latest = $_.LastWriteTimeUtc.Ticks }
    }
  return ($latest.ToString() + ':' + $count.ToString())
}
$Listener = [Net.HttpListener]::new()
$Listener.Prefixes.Add($Url)
try {
  $Listener.Start()
  Write-Host "Code Battle Lite: $Url" -ForegroundColor Green
  Write-Host "Root: $Root"
  Write-Host "Verified $($Required.Count) essential files. Live reload on. Ctrl+C to stop."
  if (-not $NoBrowser) { Start-Process $Url }
  while ($Listener.IsListening) {
    $Context = $Listener.GetContext()
    $Response = $Context.Response
    try {
      if ($Context.Request.HttpMethod -notin @('GET','HEAD')) {
        $Response.StatusCode = 405
        continue
      }
      $Requested = [Uri]::UnescapeDataString($Context.Request.Url.AbsolutePath)
      if ($Requested -eq '/__live_version') {
        $Bytes = [Text.Encoding]::UTF8.GetBytes((Get-Version))
        $Response.ContentType = 'text/plain; charset=utf-8'
      } elseif ($Requested -eq '/favicon.ico' -and
                -not [IO.File]::Exists((Join-Path $Root 'favicon.ico'))) {
        $Response.StatusCode = 204
        continue
      } else {
        $Relative = $Requested.TrimStart('/').Replace('/',[IO.Path]::DirectorySeparatorChar)
        if (-not $Relative) { $Relative = 'index.html' }
        $Path = [IO.Path]::GetFullPath((Join-Path $Root $Relative))
        if (-not $Path.StartsWith($RootPrefix,[StringComparison]::OrdinalIgnoreCase)) {
          $Response.StatusCode = 403
          continue
        }
        if (-not [IO.File]::Exists($Path)) {
          $Response.StatusCode = 404
          Write-Warning "404 $Requested (looked for $Path)"
          continue
        }
        $Ext = [IO.Path]::GetExtension($Path).ToLowerInvariant()
        $Response.ContentType = if ($Mime.ContainsKey($Ext)) { $Mime[$Ext] } else { 'application/octet-stream' }
        if ($Ext -in @('.html','.htm')) {
          $Html = [IO.File]::ReadAllText($Path,[Text.Encoding]::UTF8)
          $Bytes = [Text.Encoding]::UTF8.GetBytes($Html + [Environment]::NewLine + $Live)
        } else {
          $Bytes = [IO.File]::ReadAllBytes($Path)
        }
      }
      $Response.Headers['Cache-Control'] = 'no-store'
      $Response.ContentLength64 = $Bytes.Length
      if ($Context.Request.HttpMethod -ne 'HEAD') {
        $Response.OutputStream.Write($Bytes,0,$Bytes.Length)
      }
    } catch {
      Write-Warning ("Request failed: " + $_.Exception.Message)
    } finally {
      $Response.Close()
    }
  }
} finally {
  if ($Listener.IsListening) { $Listener.Stop() }
  $Listener.Close()
}
