Add-Type -AssemblyName System.Drawing
foreach ($lexiIconSize in @(192,512)) {
  $lexiBitmap = [System.Drawing.Bitmap]::new($lexiIconSize,$lexiIconSize)
  $lexiGraphics = [System.Drawing.Graphics]::FromImage($lexiBitmap)
  $lexiGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $lexiGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#1c2344'))
  $lexiWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $lexiPink = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#ff5078'))
  $lexiGraphics.FillRectangle($lexiWhite,[single]($lexiIconSize*.30),[single]($lexiIconSize*.25),[single]($lexiIconSize*.10),[single]($lexiIconSize*.50))
  $lexiGraphics.FillRectangle($lexiWhite,[single]($lexiIconSize*.30),[single]($lexiIconSize*.65),[single]($lexiIconSize*.38),[single]($lexiIconSize*.10))
  $lexiGraphics.FillEllipse($lexiPink,[single]($lexiIconSize*.59),[single]($lexiIconSize*.25),[single]($lexiIconSize*.17),[single]($lexiIconSize*.17))
  $lexiBitmap.Save((Join-Path (Get-Location) "public/icon-$lexiIconSize.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $lexiGraphics.Dispose(); $lexiBitmap.Dispose(); $lexiWhite.Dispose(); $lexiPink.Dispose()
}
