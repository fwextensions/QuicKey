import React, { useCallback, useContext } from "react";
import { OptionsContext } from "@/options/options-provider";
import TextButton from "@/options/demo/TextButton";

export default function SetShortcutLink()
{
	const { openTab } = useContext(OptionsContext);

	const handleClick = useCallback(
		() => openTab("chrome://extensions/shortcuts", "shortcuts"),
		[]
	);

	return (
		<TextButton
			title="Open the browser's keyboard shortcuts page"
			onClick={handleClick}
		>
			Set shortcut
		</TextButton>
	);
}
