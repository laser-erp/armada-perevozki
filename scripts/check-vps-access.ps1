# Быстрая проверка: доступен ли VPS для деплоя с этого ПК
$hostIp = "176.12.67.35"
Write-Host "SSH порт 22 → $hostIp"
$t = Test-NetConnection -ComputerName $hostIp -Port 22 -WarningAction SilentlyContinue
Write-Host "  TcpTestSucceeded: $($t.TcpTestSucceeded)"
Write-Host "HTTPS app.armada.sx/health"
try {
  $r = Invoke-WebRequest -Uri "https://app.armada.sx/armada-api/health" -UseBasicParsing -TimeoutSec 25
  Write-Host "  HTTP $($r.StatusCode)"
} catch {
  Write-Host "  FAIL: $($_.Exception.Message)"
}
if (-not $t.TcpTestSucceeded) {
  Write-Host ""
  Write-Host "С этого ПК SSH закрыт — деплой: GitHub Actions workflow Deploy staging (VPS) или другая сеть."
  exit 1
}
