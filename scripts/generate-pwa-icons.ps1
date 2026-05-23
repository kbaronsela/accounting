$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $root "public\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# צבעי אפליקציה (תואמים theme_color / manifest / כפתורי טיל)
$Bg = [System.Drawing.Color]::FromArgb(255, 244, 250, 249)      # #f4faf9 — כמו background_color ב־manifest
$Paper = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
$PaperBorder = [System.Drawing.Color]::FromArgb(255, 45, 212, 191) # teal-400
$Teal700 = [System.Drawing.Color]::FromArgb(255, 15, 118, 110)     # #0f766e
$Emerald900 = [System.Drawing.Color]::FromArgb(255, 6, 78, 59)    # #064e3b
$Teal100 = [System.Drawing.Color]::FromArgb(255, 204, 251, 241)
$Teal300 = [System.Drawing.Color]::FromArgb(255, 94, 234, 212)
$Line = [System.Drawing.Color]::FromArgb(255, 153, 246, 232)      # teal-200

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$radius) {
  $d = [Math]::Min([float]$radius * 2, [Math]::Min($w, $h))
  $r = [float]($d / 2)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath([System.Drawing.Drawing2D.FillMode]::Alternate)
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddLine($x + $r, $y, $x + $w - $r, $y)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddLine($x + $w, $y + $r, $x + $w, $y + $h - $r)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddLine($x + $w - $r, $y + $h, $x + $r, $y + $h)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.AddLine($x, $y + $h - $r, $x, $y + $r)
  $path.CloseFigure()
  return $path
}

foreach ($sz in @(192, 512)) {
  $bmp = New-Object System.Drawing.Bitmap $sz, $sz
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($Bg)

  $pad = [Math]::Max([int]($sz * 0.14), 4)
  $innerW = [float]$sz - (2 * $pad)
  $innerH = [float]$sz - (2 * $pad)

  $pw = [int]([Math]::Min($innerW, $innerH) * 0.62)
  $ph = [int]([Math]::Min($innerW, $innerH) * 0.76)
  $px = [float]$pad + ($innerW - $pw) / 2
  $py = [float]$pad + ($innerH - $ph) / 2
  $cornerR = [Math]::Max([int]($sz * 0.028), 2)

  $paperPath = New-RoundedRectPath $px $py ([float]$pw) ([float]$ph) ([float]$cornerR)
  $paperFill = New-Object System.Drawing.SolidBrush $Paper

  try {
    $g.FillPath($paperFill, $paperPath)

    $borderW = [Math]::Max([float]$sz / 192.0 * 1.35, 1.0)
    $paperBorderPen = New-Object System.Drawing.Pen $PaperBorder, $borderW
    $paperBorderPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($paperBorderPen, $paperPath)

    $headH = [Math]::Max([int]($ph * 0.16), 6)
    $regionPaper = New-Object System.Drawing.Region $paperPath
    try {
      $g.SetClip($regionPaper, [System.Drawing.Drawing2D.CombineMode]::Intersect)

      $headRect = New-Object System.Drawing.RectangleF $px, $py, $pw, $headH
      $headGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $headRect,
        $Teal700,
        $Emerald900,
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
      )
      try {
        $g.FillRectangle($headGrad, $headRect)
      } finally {
        $headGrad.Dispose()
      }

      $foldSize = [Math]::Min($pw * 0.095, [Math]::Min([float]$innerH * 0.075, [float]$ph * 0.075))
      if ($foldSize -gt 2) {
        $fx = [float]$px + $pw - $foldSize
        $fy = [float]$py + $foldSize
        $foldPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        [void]$foldPath.AddPolygon(@(
            [System.Drawing.PointF]::new($px + $pw, $py),
            [System.Drawing.PointF]::new($px + $pw, $fy),
            [System.Drawing.PointF]::new($fx, $py)
          ))
        $foldBrush = New-Object System.Drawing.SolidBrush $Teal100
        $g.FillPath($foldBrush, $foldPath)
        $foldBrush.Dispose()

        $foldPen = New-Object System.Drawing.Pen $Teal300, $borderW
        $g.DrawLines($foldPen, @(
            [System.Drawing.PointF]::new($fx, $py),
            [System.Drawing.PointF]::new($px + $pw, $fy),
            [System.Drawing.PointF]::new($px + $pw, $py)
          ))
        $foldPen.Dispose()
        $foldPath.Dispose()
      }

      $linePen = New-Object System.Drawing.Pen $Line, ([Math]::Max([float]$sz / 220.0, 1.0))
      try {
        $lineLeft = [float]$px + $pw * 0.09
        $lineRight = [float]$px + $pw * 0.91
        $bodyH = [float]$ph - $headH
        $gap = $bodyH * 0.15
        $y0 = $py + $headH + $bodyH * 0.1
        for ($li = 0; $li -lt 5; $li++) {
          $yy = [float]$y0 + ([float]$li * $gap)
          $lw = $lineRight - $lineLeft
          if (($li % 2) -eq 1) { $lw *= [float]0.72 }
          $lineRightAdjusted = [float]$lineLeft + $lw
          $g.DrawLine($linePen, $lineLeft, $yy, $lineRightAdjusted, $yy)
        }
      } finally {
        $linePen.Dispose()
      }
    } finally {
      $g.ResetClip()
      $regionPaper.Dispose()
    }

    $paperBorderPen.Dispose()
  } finally {
    $paperFill.Dispose()
    $paperPath.Dispose()
  }

  $outPath = Join-Path $outDir "icon-$sz.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()

  Write-Host "Wrote $outPath"
}
