import Input from "./input";
import {SearchIcon} from "@/common/icons";
import handleRef from "@/lib/handle-ref";
import React from "react";
import {IsFirefox} from "@/background/constants";


function Placeholder({
	mode,
	shortcut,
	text})
{
	const id = mode + "-placeholder";

	return <div id={id} className="command-placeholder">
		<b>{shortcut} </b>{text}
	</div>
}


export default class SearchBox extends React.Component {
    searchBox = null;


    componentDidMount()
	{
		var queryLength = this.props.query.length;

			// even if there's a default value, the insertion point gets set
			// to the beginning of the input field, instead of at the end.
			// so move it there after the field is created.
		this.searchBox.setSelectionRange(queryLength, queryLength);
	}


	focus()
	{
		this.searchBox.focus();
	}


	getSelection()
	{
		const {selectionStart, selectionEnd, value} = this.searchBox.input;

		return value.substring(selectionStart, selectionEnd);
	}


	handleRef = handleRef("searchBox", this);


    handleCancelButtonClick = () =>
	{
			// unlike the cancel button in Chrome, clicking the one in FF
			// steals the focus, so set it back in the input
		this.focus();
		this.props.onChange({ target: { value: "" } });
	};


    render()
	{
		const {
			query,
			mode,
			forceUpdate,
			selectAll,
			onChange,
			onKeyDown,
			onKeyUp
		} = this.props;

			// we want to show the placeholders only when the user's entered
			// the history or bookmarks mode and the query length is 3, which
			// is /h|b space.  we need to use an Input component that ignores
			// the value prop when it's focused, so that the insertion point
			// position isn't lost if the user moves it from the end and
			// starts typing.  that change is forced when the app gets an
			// esc and clears the text.
		return <div className="search-box">
			<Input type="search"
				ref={this.handleRef}
				tabIndex="0"
				placeholder="Search for a tab title or URL, or type / for more options"
				spellCheck={false}
				autoFocus={true}
				value={query}
				forceUpdate={forceUpdate}
				selectAll={selectAll}
				onChange={onChange}
				onKeyDown={onKeyDown}
				onKeyUp={onKeyUp}
			/>
			<SearchIcon />
			{mode == "bookmarks" && query.length == 3 &&
				<Placeholder mode={mode} shortcut="/b" text="Search for a bookmark title or URL" />}
			{mode == "history" && query.length == 3 &&
				<Placeholder mode={mode} shortcut="/h" text="Search for a title or URL from the browser history" />}
			{mode == "command" &&
				<Placeholder mode={mode} shortcut="/b" text="Type b for bookmark search or h for history, then a space" />}
			{(IsFirefox && query.length > 0) &&
				<div
					className="cancel-button"
					title="Clear search"
					onClick={this.handleCancelButtonClick}
				/>
			}
		</div>
	}
}
