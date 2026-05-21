$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $root "public\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

foreach ($s in @(192, 512)) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 24, 24, 27))

  # שוליים ל-maskable של אנדרואיד (מרכז מאובטח)
  $pad = [Math]::Max([int]($s * 0.14), 4)
  $innerW = $s - (2 * $pad)
  $innerH = $s - (2 * $pad)
  $fontSize = [Math]::Max([int]([Math]::Min($innerW, $innerH) * 0.55), 20)
  $fam = New-Object System.Drawing.FontFamily "Segoe UI"
  $font = New-Object System.Drawing.Font $fam, ([float]$fontSize), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF $pad, $pad, $innerW, $innerH
  $g.DrawString("ק", $font, $brush, $rect, $format)

  $path = Join-Path $outDir "icon-$s.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()

  Write-Host "Wrote $path"
}
