$ErrorActionPreference = 'Stop'
$base = 'http://localhost:8000'
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body (@{
  email = 'customer@cab.local'
  password = 'Customer123!'
} | ConvertTo-Json -Compress)
$headers = @{
  Authorization = "Bearer $($login.accessToken)"
  'Idempotency-Key' = "restart-audit-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
}
$body = @{
  pickup = @{lat = 10.7735; lng = 106.699}
  dropoff = @{lat = 10.78; lng = 106.71}
  vehicleType = 'BIKE'
} | ConvertTo-Json -Depth 4 -Compress
$before = Invoke-RestMethod -Method Post -Uri "$base/bookings/" -ContentType 'application/json' -Headers $headers -Body $body
Write-Output "BEFORE_RESTART|status=201|bookingId=$($before.bookingId)"
docker compose --env-file .env -f docker-compose.yml -f backend/tests-audit/docker-compose.audit.yml restart booking-service
if ($LASTEXITCODE -ne 0) { throw "booking-service restart failed: $LASTEXITCODE" }
$deadline = (Get-Date).AddSeconds(60)
do {
  $health = docker inspect cab-system-booking-service-1 --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}'
  if ($health -eq 'healthy') { break }
  Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
$after = Invoke-RestMethod -Method Post -Uri "$base/bookings/" -ContentType 'application/json' -Headers $headers -Body $body
$same = $before.bookingId -eq $after.bookingId
Write-Output "AFTER_RESTART|status=201|bookingId=$($after.bookingId)|sameId=$same"
if ($same) { exit 0 } else { exit 1 }
