# Добавить staging.app.armada.sx в hosts (нужен запуск от администратора)
$line = '176.12.67.35 staging.app.armada.sx'
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$text = Get-Content $hostsPath -Raw -Encoding UTF8
if ($text -match 'staging\.app\.armada\.sx') {
  Write-Host 'Уже есть в hosts.'
  exit 0
}
Add-Content -Path $hostsPath -Value "`r`n$line" -Encoding ASCII
Write-Host 'Готово: staging.app.armada.sx -> 176.12.67.35'
