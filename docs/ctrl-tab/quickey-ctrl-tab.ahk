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

; Note that there's a \u200b after the `t' of `Microsoft'
BrowserName               := "Google Chrome|Microsoft" . Chr(0x200b) . " Edge"

TicksToToggleTab          := 450
MinUpDownTicks            := 200
OpenedTickCount           := 0
SawCtrlTab                := 0

; Add patterns to this continuation section (one pattern per line) to exclude other apps
ExcludedTitlePattern      := "
( Join| Comments
(Visual Studio Code|VSCodium)( - Insiders)?$ ; VSCode / VSCodium
Developer Tools|DevTools                     ; Developer Tools
)"


IsChromiumBrowser()
{
	global ExcludedTitlePattern

	return WinActive("ahk_class Chrome_WidgetWin_1",, ExcludedTitlePattern)
}


HasPopupWindowSize()
{
	Width := 0
	WinGetPos, , , Width, , A

	return Width between 500 and 505
}


; Check if active window is search box
IsSearchBox()
{
	WinGetText, WinText, A

	return !WinText
}


IsPopupActive()
{
	global BrowserName

	return IsChromiumBrowser() and !IsSearchBox() and !WinActive(BrowserName) and HasPopupWindowSize()
}


#If IsChromiumBrowser()

; Ctrl+Tab
^Tab::
{
	if WinActive(BrowserName) or IsSearchBox() {
		SawCtrlTab := 1

		Send !{q}
		OpenedTickCount := A_TickCount

		Loop {
			; check for the popup window every 100ms
			Sleep 100

			if !SawCtrlTab {
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
	if WinActive(BrowserName) or IsSearchBox() {
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
	if (A_TickCount - OpenedTickCount < TicksToToggleTab) {
		TicksToSleep := OpenedTickCount + MinUpDownTicks - A_TickCount

		if (TicksToSleep > 0) {
			; if the QuicKey popup is closed within 450ms, it switches to the previous tab.
			; but if it's closed too quickly, it might not detect that it was opened, so
			; make sure there's at least 200ms between opening and closing it.
			Sleep TicksToSleep
		}

		; close the popup
		Send !{q}

		return
	} else if IsPopupActive() {
		Send {Enter}
	}

	return
}

#If


#If IsPopupActive()

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
