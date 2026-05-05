Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$sourcePath,
        [string]$destPath,
        [int]$width,
        [int]$height
    )
    $img = [System.Drawing.Image]::FromFile($sourcePath)
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($img, 0, 0, $width, $height)
    
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graph.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

$sourceDir = "C:\Users\gyasi\.gemini\antigravity\brain\756fa0d5-3079-49f2-b6a4-4eaad1c63345"
$destDir = "C:\Users\gyasi\.gemini\antigravity\scratch\blame_travis\assets\travis"

# Achievement
Resize-Image "$sourceDir\travis_achievement_dynamic_1777690063311.png" "$destDir\travis_achievement.png" 1024 1024

# Alert
Resize-Image "$sourceDir\travis_alert_dynamic_1777690022876.png" "$destDir\travis_alert.png" 1024 1024
Resize-Image "$sourceDir\travis_alert_dynamic_1777690022876.png" "$destDir\travis_alert_badge.png" 512 512
Resize-Image "$sourceDir\travis_alert_dynamic_1777690022876.png" "$destDir\alert.png" 1024 1024

# Idle
Resize-Image "$sourceDir\travis_idle_dynamic_1777689993584.png" "$destDir\travis_idle.png" 1024 1024
Resize-Image "$sourceDir\travis_idle_dynamic_1777689993584.png" "$destDir\travis_idle_badge.png" 512 512
Resize-Image "$sourceDir\travis_idle_dynamic_1777689993584.png" "$destDir\travis_idle_hero.png" 1536 1536
Resize-Image "$sourceDir\travis_idle_dynamic_1777689993584.png" "$destDir\idle.png" 1024 1024

# Thinking
Resize-Image "$sourceDir\travis_thinking_dynamic_1777690008899.png" "$destDir\travis_thinking.png" 1024 1024
Resize-Image "$sourceDir\travis_thinking_dynamic_1777690008899.png" "$destDir\travis_thinking_hero.png" 1536 1536
Resize-Image "$sourceDir\travis_thinking_dynamic_1777690008899.png" "$destDir\thinking.png" 1024 1024

# Tracking
Resize-Image "$sourceDir\travis_tracking_dynamic_1777690048413.png" "$destDir\travis_tracking.png" 1024 1024
Resize-Image "$sourceDir\travis_tracking_dynamic_1777690048413.png" "$destDir\travis_tracking_badge.png" 512 512
Resize-Image "$sourceDir\travis_tracking_dynamic_1777690048413.png" "$destDir\travis_tracking_hero.png" 1536 1536
Resize-Image "$sourceDir\travis_tracking_dynamic_1777690048413.png" "$destDir\tracking.png" 1024 1024
