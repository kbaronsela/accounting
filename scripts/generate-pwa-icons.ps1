$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$outDir = Join-Path $root "public\icons"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

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

  # רקע zinc-950 (מתאים ל־manifest theme)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 24, 24, 27))

  $pad = [Math]::Max([int]($sz * 0.14), 4)
  $innerW = [float]$sz - (2 * $pad)
  $innerH = [float]$sz - (2 * $pad)

  $pw = [int]([Math]::Min($innerW, $innerH) * 0.62)
  $ph = [int]([Math]::Min($innerW, $innerH) * 0.76)
  $px = [float]$pad + ($innerW - $pw) / 2
  $py = [float]$pad + ($innerH - $ph) / 2
  $cornerR = [Math]::Max([int]($sz * 0.028), 2)

  $paperPath = New-RoundedRectPath $px $py ([float]$pw) ([float]$ph) ([float]$cornerR)
  $paperFill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 250, 251, 252))

  try {
    $g.FillPath($paperFill, $paperPath)

    $borderW = [Math]::Max([float]$sz / 192.0 * 1.25, 1.0)
    $paperBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 203, 213, 225), $borderW)
    $paperBorder.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $g.DrawPath($paperBorder, $paperPath)

    # פרטי תוכן (כותרת, קיפול, שורות) — בתוך גבולות המסמך
    $headH = [Math]::Max([int]($ph * 0.16), 6)
    $regionPaper = New-Object System.Drawing.Region $paperPath
    try {
      $g.SetClip($regionPaper, [System.Drawing.Drawing2D.CombineMode]::Intersect)

      $headBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 51, 65, 85))
    try {
      $headRect = New-Object System.Drawing.RectangleF $px, $py, $pw, $headH
      $g.FillRectangle($headBrush, $headRect)

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
        $foldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 226, 232, 240))
        $g.FillPath($foldBrush, $foldPath)
        $foldPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 148, 163, 184), $borderW)
        $g.DrawLines($foldPen, @(
            [System.Drawing.PointF]::new($fx, $py),
            [System.Drawing.PointF]::new($px + $pw, $fy),
            [System.Drawing.PointF]::new($px + $pw, $py)
          ))
        $foldPen.Dispose()
        $foldBrush.Dispose()
        $foldPath.Dispose()
      }

      $linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 203, 213, 225), [Math]::Max([float]$sz / 192.0, 1.0))
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
      $headBrush.Dispose()
    }
    } finally {
      $g.ResetClip()
      $regionPaper.Dispose()
    }

    $paperBorder.Dispose()
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
