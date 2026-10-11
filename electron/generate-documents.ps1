param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = 'Stop'
$request = Get-Content -LiteralPath $InputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$files = [System.Collections.Generic.List[string]]::new()
$word = $null
$powerpoint = $null
function Replace-PowerPointText($presentation, $replacements) {
  foreach ($slide in $presentation.Slides) {
    foreach ($shape in $slide.Shapes) {
      if ($shape.HasTable) {
        for ($row = 1; $row -le $shape.Table.Rows.Count; $row++) {
          for ($column = 1; $column -le $shape.Table.Columns.Count; $column++) {
            $range = $shape.Table.Cell($row, $column).Shape.TextFrame.TextRange
            foreach ($property in $replacements.PSObject.Properties) {
              $null = $range.Replace($property.Name, [string]$property.Value, 0, $false, $false)
            }
          }
        }
      }
      if ($shape.HasTextFrame) {
        foreach ($property in $replacements.PSObject.Properties) {
          $null = $shape.TextFrame.TextRange.Replace($property.Name, [string]$property.Value, 0, $false, $false)
        }
      }
    }
  }
}
function Replace-WordText($document, $replacements) {
  foreach ($property in $replacements.PSObject.Properties) {
    $find = $document.Content.Find
    $find.ClearFormatting()
    $find.Replacement.ClearFormatting()
    $find.Text = $property.Name
    $find.Replacement.Text = [string]$property.Value
    $find.Forward = $true
    $find.Wrap = 1
    $find.Execute($property.Name, $false, $false, $false, $false, $false, $true, 1, $false, [string]$property.Value, 2) | Out-Null
  }
}
function Get-SlideText($slide) {
  $text = [System.Text.StringBuilder]::new()
  foreach ($shape in $slide.Shapes) {
    if ($shape.HasTextFrame) { [void]$text.Append($shape.TextFrame.TextRange.Text) }
    if ($shape.HasTable) {
      for ($row = 1; $row -le $shape.Table.Rows.Count; $row++) {
        for ($column = 1; $column -le $shape.Table.Columns.Count; $column++) {
          [void]$text.Append($shape.Table.Cell($row, $column).Shape.TextFrame.TextRange.Text)
        }
      }
    }
  }
  return $text.ToString()
}
function Get-NormalizedKey([string]$value) {
  return (($value.Normalize([System.Text.NormalizationForm]::FormD) -replace '\p{Mn}', '') -replace '[^a-zA-Z0-9]', '').ToLowerInvariant()
}
try {
  if (!(Test-Path -LiteralPath $request.outputFolder -PathType Container)) { throw 'A pasta de destino nao existe.' }
  if ($request.documents -contains 'proposal') {
    if (!(Test-Path -LiteralPath $request.templates.proposal -PathType Leaf)) { throw 'Selecione um modelo de proposta PPTX nas configuracoes.' }
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.DisplayAlerts = 1
    $presentation = $powerpoint.Presentations.Open($request.templates.proposal, $true, $false, $false)
    try {
      $serviceByToken = @{}
      foreach ($item in $request.priceTokens) { $serviceByToken[[string]$item.token] = [string]$item.service }
      $slidesToRemove = [System.Collections.Generic.List[int]]::new()
      foreach ($slide in $presentation.Slides) {
        $slideTokens = [regex]::Matches((Get-SlideText $slide), '#[^#\r\n]{1,100}#')
        if ($slideTokens.Count -eq 0) { continue }
        $isExcludedCategory = $true
        foreach ($match in $slideTokens) {
          $service = [string]$serviceByToken[$match.Value]
          $serviceKey = $service.Normalize([System.Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
          $excluded = (!$request.rdi -and $serviceKey -match 'RDI') -or (!$request.mtg -and $serviceKey -match 'MTG|METODOS GRAFICOS')
          if (!$excluded) { $isExcludedCategory = $false; break }
        }
        if ($isExcludedCategory) { $slidesToRemove.Add($slide.SlideIndex) }
      }
      foreach ($index in ($slidesToRemove | Sort-Object -Descending)) {
        if ($index -le $presentation.Slides.Count) { $presentation.Slides.Item($index).Delete() }
      }
      Replace-PowerPointText $presentation $request.replacements
      $unresolved = [System.Collections.Generic.List[string]]::new()
      foreach ($slide in $presentation.Slides) {
        foreach ($shape in $slide.Shapes) {
          if ($shape.HasTextFrame) {
            foreach ($match in [regex]::Matches($shape.TextFrame.TextRange.Text, '#[^#\r\n]{1,100}#')) { $unresolved.Add($match.Value) }
          }
          if ($shape.HasTable) {
            for ($row = 1; $row -le $shape.Table.Rows.Count; $row++) {
              for ($column = 1; $column -le $shape.Table.Columns.Count; $column++) {
                foreach ($match in [regex]::Matches($shape.Table.Cell($row, $column).Shape.TextFrame.TextRange.Text, '#[^#\r\n]{1,100}#')) { $unresolved.Add($match.Value) }
              }
            }
          }
        }
      }
      if ($unresolved.Count) { throw "Campos sem valor na proposta: $((@($unresolved | Select-Object -Unique)) -join ', '). Confira os precos e os dados de contato." }
      $stem = Join-Path $request.outputFolder ($request.fileStem + ' - Proposta')
      if ($request.formats -contains 'editable') {
        $pptx = "$stem.pptx"
        $presentation.SaveAs($pptx, 24)
        $files.Add($pptx)
      }
      if ($request.formats -contains 'pdf') {
        $pdf = "$stem.pdf"
        $presentation.ExportAsFixedFormat($pdf, 2)
        $files.Add($pdf)
      }
    } finally { $presentation.Close() }
  }
  foreach ($kind in @('contract', 'addendum')) {
    if ($request.documents -notcontains $kind) { continue }
    if (!(Test-Path -LiteralPath $request.templates.$kind -PathType Leaf)) { throw "Selecione um modelo de $kind nas configuracoes." }
    if (!$word) { $word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0 }
    $document = $word.Documents.Open($request.templates.$kind, $false, $true)
    try {
      if ($kind -eq 'addendum') {
        $templateText = $document.Content.Text
        $normalizedTokens = [System.Collections.Generic.List[string]]::new()
        foreach ($match in [regex]::Matches($templateText, '#([^#\r\n]{1,100})#')) { $normalizedTokens.Add((Get-NormalizedKey $match.Groups[1].Value)) }
        if (!$normalizedTokens.Contains('razaosocial') -or !$normalizedTokens.Contains('cnpj')) {
          throw 'O modelo de termo aditivo precisa conter os campos #RAZAO SOCIAL# e #CNPJ#. O arquivo recebido tem dados fixos de outra empresa.'
        }
      }
      Replace-WordText $document $request.replacements
      $unresolved = [regex]::Matches($document.Content.Text, '#[^#\r\n]{1,100}#') | ForEach-Object { $_.Value } | Select-Object -Unique
      if ($unresolved) { throw "Campos sem valor no modelo: $($unresolved -join ', '). Confira os dados e o modelo generico." }
      $label = if ($kind -eq 'contract') { 'Contrato' } else { 'Termo Aditivo' }
      $stem = Join-Path $request.outputFolder ($request.fileStem + " - $label")
      if ($request.formats -contains 'editable') {
        $docx = "$stem.docx"
        $document.SaveAs2($docx, 16)
        $files.Add($docx)
      }
      if ($request.formats -contains 'pdf') {
        $pdf = "$stem.pdf"
        $document.ExportAsFixedFormat($pdf, 17)
        $files.Add($pdf)
      }
    } finally { $document.Close(0) }
  }
  [pscustomobject]@{ files = @($files.ToArray()) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $request.resultPath -Encoding UTF8
} catch {
  [pscustomobject]@{ error = $_.Exception.Message } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $request.resultPath -Encoding UTF8
  exit 1
} finally {
  if ($powerpoint) { $powerpoint.Quit() }
  if ($word) { $word.Quit() }
}
