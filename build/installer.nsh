; 自定义安装程序脚本
; 创建桌面快捷方式
CreateShortCut "$DESKTOP\WordWord.lnk" "$INSTDIR\WordWord.exe" "" "$INSTDIR\resources\app.asar.unpacked\assets\icon.png" 0

; 创建开始菜单快捷方式
CreateDirectory "$SMPROGRAMS\WordWord"
CreateShortCut "$SMPROGRAMS\WordWord\WordWord.lnk" "$INSTDIR\WordWord.exe" "" "$INSTDIR\resources\app.asar.unpacked\assets\icon.png" 0

; 注册文件关联
WriteRegStr HKCR ".ww" "" "WordWord Document"
WriteRegStr HKCR ".ww\DefaultIcon" "" "$INSTDIR\resources\app.asar.unpacked\assets\icon.png"
WriteRegStr HKCR ".ww\shell\open\command" "" '"$INSTDIR\WordWord.exe" "%1"'