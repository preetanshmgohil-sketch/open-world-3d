# Prepare texture payload: resize + re-encode polyhaven JPGs, build a contact sheet for review.
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

Write-Host '--- encoding polyhaven set ---'
Encode-Jpg "$src\asp_d.jpg" "$out\asp_d.jpg" 1024 1024 80
Encode-Jpg "$src\asp_n.jpg" "$out\asp_n.jpg"  512  512 82
Encode-Jpg "$src\asp_r.jpg" "$out\asp_r.jpg"  512  512 62
Encode-Jpg "$src\pv_d.jpg"  "$out\pv_d.jpg"  1024 1024 80
Encode-Jpg "$src\pv_n.jpg"  "$out\pv_n.jpg"   512  512 82
Encode-Jpg "$src\gr_d.jpg"  "$out\gr_d.jpg"  1024 1024 80
Encode-Jpg "$src\gr_n.jpg"  "$out\gr_n.jpg"   512  512 82
Encode-Jpg "$src\dg_d.jpg"  "$out\dg_d.jpg"  1024 1024 80
Encode-Jpg "$src\dg_n.jpg"  "$out\dg_n.jpg"   512  512 82
$tot=(Get-ChildItem "$out\*.jpg"|Measure-Object -Property Length -Sum).Sum
Write-Host ("total payload: {0} KB" -f [Math]::Round($tot/1KB))

Write-Host '--- contact sheet ---'
$tiles=@(
 @("$out\asp_d.jpg",'PH worn_asphalt'),
 @("$out\pv_d.jpg",'PH concrete_pavers'),
 @("$out\gr_d.jpg",'PH grass_ground'),
 @("$out\dg_d.jpg",'PH dry_ground_01'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_ground_dirt.png",'K dirt'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_ground_grass.png",'K grass'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_ground_sand.png",'K sand'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_wood_planks.png",'K planks'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_wood_planks_wide.png",'K planks wide'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_tiles_tan_large.png",'K tan tiles'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\wall_rock.png",'K rock wall'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\wall_brick_small_stone.png",'K stone brick'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\floor_stone_pattern_small.png",'K stone patt'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\wall_timber.png",'K timber'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\roof_clay_red_center.png",'K clay roof'),
 @("$root\..\kenney_retro-textures-fantasy\PNG\window_square_pane.png",'K window')
)
$T=160;$cols=4;$rows=[Math]::Ceiling($tiles.Count/$cols)
$sheet=New-Object System.Drawing.Bitmap(($cols*$T),(($rows*$T)+($rows*4)))
$sg=[System.Drawing.Graphics]::FromImage($sheet)
$sg.Clear([System.Drawing.Color]::FromArgb(30,30,34))
$sg.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fnt=New-Object System.Drawing.Font('Consolas',9)
$br=[System.Drawing.Brushes]::White
for($i=0;$i -lt $tiles.Count;$i++){
  $c=$i%$cols;$r=[Math]::Floor($i/$cols)
  $x=$c*$T;$y=$r*($T+4)
  try{
    $im=[System.Drawing.Image]::FromFile($tiles[$i][0])
    $sg.DrawImage($im,$x,$y,$T,$T);$w=(Get-Item $tiles[$i][0]).Length
    $im.Dispose()
  }catch{ $sg.DrawString('ERR',$fnt,$br,$x,$y) }
  $info="{0} {1}x{2}" -f $tiles[$i][1],0,0
  $sg.DrawString($tiles[$i][1],$fnt,$br,($x+2),($y+$T-14))
}
$sg.Dispose()
$sheet.Save("$src\_contact.png",[System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Host "contact sheet saved: tex_src\_contact.png"
