!macro customInit
  ; 殺掉正在跑的新舊版本（舊版常駐系統匣會搶 single-instance）
  nsExec::Exec 'taskkill /F /IM "SpeakSlow.exe" /T'
  nsExec::Exec 'taskkill /F /IM "聲聲慢.exe" /T'
  Sleep 500
  ; 靜默移除舊的「聲聲慢」安裝（productName 改名前的版本）
  IfFileExists "$LOCALAPPDATA\Programs\聲聲慢\Uninstall 聲聲慢.exe" 0 skipOldUninstall
    ExecWait '"$LOCALAPPDATA\Programs\聲聲慢\Uninstall 聲聲慢.exe" /S _?=$LOCALAPPDATA\Programs\聲聲慢'
  skipOldUninstall:
  RMDir /r "$LOCALAPPDATA\Programs\聲聲慢"
!macroend