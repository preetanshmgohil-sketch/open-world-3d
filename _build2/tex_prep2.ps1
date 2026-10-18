# Prepare the character/vehicle texture payload (Polyhaven CC0 fabric/fabric/leather/rubber set).
# Mirrors tex_prep.ps1 but only touches the new files -> tex_out.
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $root 'tex_src'
$out  = Join-Path $root 'tex_out'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Encode-Jpg([string]$inPath,[string]$outPath,[int]$w,[int]$h,[int]$q){
  $img=[System.Drawing.Image]::FromFile($inPath)
  try{
    $bmp=New-Object System.Drawing.Bitmap($w,$h)
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img,0,0,$w,$h)
    $g.Dispose()
    $codec=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'}
    $ps=New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ps.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]$q)
    $bmp.Save($outPath,$codec,$ps)
    $bmp.Dispose()
  } finally { $img.Dispose() }
  $kb=[Math]::Round((Get-Item $outPath).Length/1KB)
  Write-Host ("  {0} -> {1}px q{2} = {3} KB" -f (Split-Path -Leaf $inPath),$w,$q,$kb)
}

Write-Host '--- encoding characters/vehicles set ---'
Encode-Jpg "$src\dnm_d.jpg" "$out\dnm_d.jpg" 512 512 80
Encode-Jpg "$src\dnm_n.jpg" "$out\dnm_n.jpg" 512 512 82
Encode-Jpg "$src\jrs_d.jpg" "$out\jrs_d.jpg" 512 512 80
Encode-Jpg "$src\jrs_n.jpg" "$out\jrs_n.jpg" 512 512 82
Encode-Jpg "$src\lin_d.jpg" "$out\lin_d.jpg" 512 512 80
Encode-Jpg "$src\lin_n.jpg" "$out\lin_n.jpg" 512 512 82
Encode-Jpg "$src\ltr_d.jpg" "$out\ltr_d.jpg" 256 256 78
Encode-Jpg "$src\ltr_n.jpg" "$out\ltr_n.jpg" 256 256 80
Encode-Jpg "$src\rub_d.jpg" "$out\rub_d.jpg" 256 256 76
Encode-Jpg "$src\rub_n.jpg" "$out\rub_n.jpg" 256 256 78
$tot=(Get-ChildItem "$out\dnm_*","$out\jrs_*","$out\lin_*","$out\ltr_*","$out\rub_*"|Measure-Object -Property Length -Sum).Sum
Write-Host ("new payload: {0} KB" -f [Math]::Round($tot/1KB))
