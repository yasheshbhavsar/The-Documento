param(
    [string]$ImagePath
)

Add-Type -AssemblyName System.Drawing
[Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
    Write-Error "Could not initialize Windows Media OcrEngine"
    exit 1
}

$fullPath = (Resolve-Path $ImagePath).Path
$fileOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)
while ($fileOp.Status -eq [Windows.Foundation.AsyncStatus]::Started) { Start-Sleep -Milliseconds 10 }
$file = $fileOp.GetResults()

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
while ($streamOp.Status -eq [Windows.Foundation.AsyncStatus]::Started) { Start-Sleep -Milliseconds 10 }
$stream = $streamOp.GetResults()

$decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
while ($decOp.Status -eq [Windows.Foundation.AsyncStatus]::Started) { Start-Sleep -Milliseconds 10 }
$dec = $decOp.GetResults()

$bmpOp = $dec.GetSoftwareBitmapAsync()
while ($bmpOp.Status -eq [Windows.Foundation.AsyncStatus]::Started) { Start-Sleep -Milliseconds 10 }
$bmp = $bmpOp.GetResults()

$ocrOp = $engine.RecognizeAsync($bmp)
while ($ocrOp.Status -eq [Windows.Foundation.AsyncStatus]::Started) { Start-Sleep -Milliseconds 10 }
$ocrResult = $ocrOp.GetResults()

$lines = @()
foreach ($line in $ocrResult.Lines) {
    $lines += $line.Text
}

$output = @{
    Text = $ocrResult.Text
    Lines = $lines
}

$output | ConvertTo-Json -Depth 3
