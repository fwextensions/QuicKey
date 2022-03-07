#NoEnv                  ;
SetBatchLines, -1       ; Script will never sleep
ListLines Off           ; Omits subsequently-executed lines from the history
#KeyHistory 0           ; Disable key history
SendMode Input          ; Recommended for new scripts due to its superior speed and reliability
SetTitleMatchMode RegEx ;
SetTitleMatchMode Fast  ;
SetKeyDelay, -1, -1     ;

#SingleInstance force   ; Skips the dialog box and replaces the old instance automatically
;#NoTrayIcon             ; Hide the tray icon
#MaxMem 1               ; Maximum memory per variable - 1MB

SetKeyDelay, -1, -1     ; No delay at all will occur after each keystroke sent by Send and ControlSend
SetWinDelay, 0          ; Changed to 0 upon recommendation of documentation


BrowserName              := "Google Chrome|Edge"
DeveloperToolsWindowTitle := "Developer Tools"
TicksToToggleTab          := 450
MinUpDownTicks            := 200
OpenedTickCount           := 0
SawCtrlTab                := 0

ExcludeTitles             := ["(Visual Studio Code|VSCodium)( - Insiders)?$"] ; VSCode / VSCodium

ExcludeTitle := ExcludeTitles[1]
For Idx, Title in ExcludeTitles {
	If (Idx > 1) {
		ExcludeTitle .= "|" . Title
	}
}


IsChromiumBasedBrowser()
{
	global ExcludeTitle

	return WinActive("ahk_class Chrome_WidgetWin_1",, ExcludeTitle)
}


HasPopupWindowSize()
{
	Width := 0
	WinGetPos, , , Width, , A
	return Width between 500 and 505
}


IsPopupActive()
{
	global BrowserName, DeveloperToolsWindowTitle

	return WinActive("ahk_class Chrome_WidgetWin_1") and !WinActive(BrowserName) and !WinActive(DeveloperToolsWindowTitle) and HasPopupWindowSize()
}


#If IsChromiumBasedBrowser()

; Ctrl+Tab
^Tab::
{
	if WinActive(BrowserName)
	{
		SawCtrlTab := 1

		Send !{q}
		OpenedTickCount := A_TickCount

		Loop {
			; check for the popup window every 100ms
			Sleep 100

			if !SawCtrlTab
			{
				; if this is no longer 1, it means ctrl up was heard while we
				; were sleeping, so exit
				Exit
			} else if IsPopupActive() {
				; now that we've seen the popup, give the JS some time to load
				Sleep 300

				; check that the popup is still active before sending the down
				; arrow, since it might have closed while we were sleeping, and
				; then it would scroll the previously active window
				if IsPopupActive() {
					Send {Down}
				}

				Exit
			}
		}
	} else {
		Send {Down}
	}

	return
}


; Ctrl+Shift+Tab
^+Tab::
{
	if WinActive(BrowserName)
	{
		Send !{q}
		OpenedTickCount := A_TickCount
	} else {
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

		if IsPopupActive()
		{
			Send {Enter}
		}
	}

	return
}

#If


#If IsChromiumBasedBrowser() and IsPopupActive()

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