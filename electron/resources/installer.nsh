; Remove the autostart entry this product created via app.setLoginItemSettings.
; The registry value name is the product title (see electron/main/launch-at-login.ts).
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCT_NAME}"
!macroend
