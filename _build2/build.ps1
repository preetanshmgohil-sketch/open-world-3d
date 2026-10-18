# Rebuild index1.html from _build2/base.html + _build2/parts/sNN_*.js
# Auto-regenerates generated parts (s20/s23/s24/s25) when missing. Use -Regen to force.
param([switch]$Regen)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$basePath = Join-Path $root 'base.html'
$partsDir = Join-Path $root 'parts'
$outPath  = Join-Path (Split-Path -Parent $root) 'index1.html'

function Invoke-Gen([string]$script) {
  Write-Host "[build] running $script ..."
  & node (Join-Path $root $script)
  if ($LASTEXITCODE -ne 0) { throw "$script failed (is Node.js installed and on PATH?)" }
}
if ($Regen -or -not (Test-Path (Join-Path $partsDir 's20_texdata.js'))) { Invoke-Gen 'gen_texdata.js' }
if ($Regen -or -not (Test-Path (Join-Path $partsDir 's23_gltf.js')) -or -not (Test-Path (Join-Path $partsDir 's24_skel.js')) -or -not (Test-Path (Join-Path $partsDir 's25_mdl_data.js'))) { Invoke-Gen 'gen_models.js' }

$base = [IO.File]::ReadAllText($basePath)
$marker = '<!--@@PARTS@@-->'
if ($base.IndexOf($marker) -lt 0) { throw "marker not found in base.html" }

$parts = Get-ChildItem -Path $partsDir -Filter 's*.js' | Sort-Object Name
if ($parts.Count -eq 0) { throw "no parts found" }

$sb = New-Object System.Text.StringBuilder
foreach ($p in $parts) {
  $code = [IO.File]::ReadAllText($p.FullName)
  [void]$sb.AppendLine('<script>/* ==== ' + $p.Name + ' ==== */')
  [void]$sb.AppendLine($code)
  [void]$sb.AppendLine('</script>')
}
$inject = $sb.ToString()
$out = $base.Replace($marker, $inject)
[IO.File]::WriteAllText($outPath, $out, (New-Object System.Text.UTF8Encoding($false)))
$kb = [Math]::Round((Get-Item $outPath).Length / 1KB)
Write-Host "Built index1.html : $kb KB from $($parts.Count) parts"
