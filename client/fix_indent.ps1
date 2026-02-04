$file='d:/word/web/client/index.html'
$c=Get-Content $file -Raw
$c=$c.Replace('                    const StudentPortal','        const StudentPortal')
$c=$c.Replace('                    const AssessorPortal','        const AssessorPortal')
$c=$c.Replace('                    console.log','        console.log')
Set-Content $file $c -NoNewline
Write-Host "Fixed indentation"
