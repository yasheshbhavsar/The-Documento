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
$fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($fullPath)
$fileTask.AsTask().Wait()
$storageFile = $fileTask.GetResults()

$streamTask = $storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$streamTask.AsTask().Wait()
$stream = $streamTask.GetResults()

$decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoderTask.AsTask().Wait()
$decoder = $decoderTask.GetResults()

$bitmapTask = $decoder.GetSoftwareBitmapAsync()
$bitmapTask.AsTask().Wait()
$bitmap = $bitmapTask.GetResults()

$ocrTask = $engine.RecognizeAsync($bitmap)
$ocrTask.AsTask().Wait()
$result = $ocrTask.GetResults()

$lines = @()
foreach ($line in $result.Lines) {
    $lines += $line.Text
}

$output = @{
    Text = $result.Text
    Lines = $lines
}

$output | ConvertTo-Json -Depth 3
