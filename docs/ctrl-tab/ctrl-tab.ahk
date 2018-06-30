#NoEnv                  ;
SetBatchLines, -1       ; Script will never sleep
ListLines Off           ; Omits subsequently-executed lines from the history
#KeyHistory 0           ; Disable key history
SendMode Input          ; Recommended for new scripts due to its superior speed and reliability
SetTitleMatchMode 2     ;
SetTitleMatchMode Fast  ;
SetKeyDelay, -1, -1     ;

#SingleInstance force   ; Skips the dialog box and replaces the old instance automatically
;#NoTrayIcon             ; Hide the tray icon
#MaxMem 1               ; Maximum memory per variable - 1MB

SetKeyDelay, -1, -1     ; No delay at all will occur after each keystroke sent by Send and ControlSend
SetWinDelay, 0          ; Changed to 0 upon recommendation of documentation


WindowTitle               := "Google Chrome"
DeveloperToolsWindowTitle := "Developer Tools"
TicksToOpenPopup          := 500
TicksToToggleTab          := 450
MinUpDownTicks            := 200
OpenedTickCount           := 0
SawCtrlTab                := 0


HasPopupWindowSize()
{
    Width := 0
    WinGetPos, , , Width, , A
    return Width between 500 and 505
}


#IfWinActive ahk_exe Chrome.exe

; Ctrl+Tab
^Tab::
{
    IfWinActive % WindowTitle
    {
        SawCtrlTab := 1

        Send !{q}
        OpenedTickCount := A_TickCount
		Sleep TicksToOpenPopup

		; the QuicKey popup might have been closed while we were sleeping
		if WinActive("ahk_class Chrome_WidgetWin_1") and !WinActive(WindowTitle) and !WinActive(DeveloperToolsWindowTitle) and HasPopupWindowSize()
		{
	        Send {Down}
		}
    }
    else
    {
        Send {Down}
    }

    return
}


; Ctrl+Shift+Tab
^+Tab::
{
    IfWinActive % WindowTitle
    {
        Send !{q}
        OpenedTickCount := A_TickCount
    }
    else
    {
        Send {Up}
    }

    return
}


; Ctrl keyup
~Ctrl Up::
{
	if (SawCtrlTab = 1)
	{
	    SawCtrlTab := 0

	    if (A_TickCount - OpenedTickCount < TicksToToggleTab)
	    {
		    TicksToSleep := OpenedTickCount + MinUpDownTicks - A_TickCount

		    if (TicksToSleep > 0)
		    {
		        ; if the QuicKey popup is closed within 450ms, it switches to the previous tab.
		        ; but if it's closed too quickly, it might not detect that it was opened, so
		        ; make sure there's at least 200ms between opening and closing it.
		        Sleep TicksToSleep
	        }

			; close the popup
	        Send !{q}

	        return
	    }

	    if WinActive("ahk_class Chrome_WidgetWin_1") and !WinActive(WindowTitle) and !WinActive(DeveloperToolsWindowTitle) and HasPopupWindowSize()
	    {
	        Send {Enter}
	    }
	}

    return
}

#IfWinActive


#If WinActive("ahk_exe Chrome.exe") and WinActive("ahk_class Chrome_WidgetWin_1") and !WinActive(WindowTitle) and !WinActive(DeveloperToolsWindowTitle) and HasPopupWindowSize()

; Ctrl+Right, Ctrl+Shift+Right, Ctrl+Shift+Down
^Right::
^+Right::
^Down::
^+Down::
{
    Send {Down}
    return
}


; Ctrl+Left, Ctrl+Shift+Left, Ctrl+Shift+Up
^Left::
^+Left::
^Up::
^+Up::
{
    Send {Up}
    return
}


; Ctrl+Esc
^Esc::
{
    Send {Esc}
    return
}

#If