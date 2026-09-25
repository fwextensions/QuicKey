import MatchedString from "./matched-string";
import {
	HistoryIcon,
	IncognitoIcon,
	WindowIcon,
	ClearIcon
} from "@/common/icons";
import copyTextToClipboard from "@/lib/copy-to-clipboard";
import {getRelativeTime} from "@/lib/get-relative-time";
import {ModKeyBoolean} from "@/options/key-constants";
import {IsDev, IncognitoNameLC} from "@/background/constants";
import React from "react";
import _ from "lodash";


const MaxTitleLength = 70;
const MaxURLLength = 75;
const SuspendedFaviconOpacity = .5;
const FaviconURL = "chrome://favicon/";
const CloseButtonTooltips = {
	tabs: "Close tab",
	bookmarks: "Delete bookmark",
	closedTab: "Remove this closed tab from the browser history",
	history: "Remove this page from the browser history"
};
const IncognitoTooltip = `This tab is in ${IncognitoNameLC} mode`;


export default class ResultsListItem extends React.Component {
    onClick = (
		event) =>
	{
		const {shiftKey, altKey} = event;
		const {item} = this.props;

		if (IsDev && altKey && shiftKey) {
				// copy some debug info to the clipboard
			copyTextToClipboard([
				item.title,
				item.displayURL,
				this.props.query,
				item.recentBoost,
				_.toPairs(item.scores).map(a => a.join(": ")).join("\n"),
			].join("\n"));
		} else {
				// pass in whether ctrl or cmd was pressed while clicking
			this.props.openItem(item, shiftKey, event[ModKeyBoolean]);
		}
	};


    handleClose = (
		event) =>
	{
			// stop the click from bubbling so the tab doesn't get focused
			// just before it's closed
		event.stopPropagation();
		this.props.closeTab(this.props.item);
	};


    handleCloseMouseDown = (
		event) =>
	{
			// prevent the click from stealing focus from the search box
		event.preventDefault();
	};


    handleFaviconError = (
		event) =>
	{
		const {item} = this.props;
		const {fallbackFaviconURL} = item;

			// the item's own favicon failed to load, most likely because the
			// site blocks it with cross-origin-resource-policy.  switch this
			// item to the fallback so it doesn't try the blocked one again
			// if it's re-rendered.  setting src directly sticks until React
			// renders a different faviconURL into this recycled row.
		if (fallbackFaviconURL && item.faviconURL !== fallbackFaviconURL) {
			item.faviconURL = fallbackFaviconURL;
			event.currentTarget.src = fallbackFaviconURL;
		}
	};


    handleMouseMove = () =>
	{
		this.props.onHover(this.props.index);
	};


    render()
	{
		const {
			item,
			query,
			mode,
			style,
			isSelected
		} = this.props;
		const {
			scores,
			hitMasks,
			title,
			titleIndex,
			displayURL,
			unsuspendURL,
			faviconURL,
			pinyinTitle,
			pinyinDisplayURL,
			sessionId,
			suspended,
			otherWindow,
			incognito
		} = item;
		const className = [
			"results-list-item",
			mode,
			isSelected ? "selected" : "",
			(unsuspendURL || suspended) ? "suspended" : "",
			incognito ? "incognito" :
				(otherWindow ? "other-window" : ""),
			sessionId ? "closed" : ""
		].join(" ");
		const faviconStyle = {};
		let tooltip = [
			title.length > MaxTitleLength ? title : "",
			displayURL.length > MaxURLLength ? displayURL : ""
		].join("\n");
		let badge = null;
		let badgeTooltip = "";

		if (IsDev) {
			tooltip = _.toPairs(scores)
				.concat([
					["recentBoost", item.recentBoost],
					["id", item.id],
					["score", item.score],
					item.lastVisit ? ["lastVisit", getRelativeTime(item.lastVisit)] : [],
				])
				.map(keyValue => keyValue.join(": "))
				.concat([title != pinyinTitle && pinyinTitle, displayURL != pinyinDisplayURL && pinyinDisplayURL])
				.filter(string => string)
				.join("\n") + "\n" + tooltip;
		}

			// blank lines at the end of the tooltip show up in macOS Chrome,
			// so trim them
		tooltip = tooltip.trim();

		if (
			(unsuspendURL && faviconURL.indexOf(FaviconURL) == 0 && !sessionId)
			|| suspended
		) {
				// this tab was discarded/frozen by Chrome, or The Great Suspender
				// suspended it and forgot  the faded favicon for it or has set
				// its own icon for some reason.  so we get the favicon through
				// chrome://favicon/ and then fade it ourselves.
			faviconStyle.opacity = SuspendedFaviconOpacity;
		}

		if (incognito) {
			badge = <IncognitoIcon />;
			badgeTooltip = IncognitoTooltip;
		} else if (otherWindow) {
			badge = <WindowIcon />;
			badgeTooltip = "This tab is in another window";
		} else if (sessionId) {
			badge = <HistoryIcon />;
			badgeTooltip = "This tab was closed recently";
		}

		return <div className={className}
			style={style}
			title={tooltip}
			onClick={this.onClick}
			onMouseMove={this.handleMouseMove}
		>
				{/* use an img rather than a background-image, since only an
					img tells us when the favicon fails to load */}
			<img className="favicon"
				src={faviconURL}
				alt=""
				draggable={false}
				style={faviconStyle}
				onError={this.handleFaviconError}
			/>
			<div className="badge"
				title={badgeTooltip}
			>
				{badge}
			</div>
			<div className="title">
				{titleIndex &&
					<div className="title-index"
						title="Position among tabs with the same title"
					>{titleIndex}</div>}
				<MatchedString
					query={query}
					text={title}
					score={scores.title}
					hitMask={hitMasks.title}
				/>
			</div>
			<div className="url">
				<MatchedString
					query={query}
					text={displayURL}
					score={scores.displayURL}
					hitMask={hitMasks.displayURL}
				/>
			</div>
			<button className="close-button"
				title={CloseButtonTooltips[sessionId ? "closedTab" : mode]}
				onClick={this.handleClose}
				onMouseDown={this.handleCloseMouseDown}
			>
				<ClearIcon />
			</button>
		</div>
	}
}
