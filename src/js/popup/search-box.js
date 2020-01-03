define([
	"jsx!./input",
	"lib/handle-ref",
	"react"
], function(
	Input,
	handleRef,
	React
) {
	function Placeholder(
		props)
	{
		var id = props.mode + "-placeholder";

		return <div id={id} className="command-placeholder">
			<b>{props.shortcut} </b>{props.text}
		</div>
	}


	var SearchBox = React.createClass({
		searchBox: null,


		componentDidMount: function()
		{
			var queryLength = this.props.query.length;

				// even if there's a default value, the insertion point gets set
				// to the beginning of the input field, instead of at the end.
				// so move it there after the field is created.
			this.searchBox.setSelectionRange(queryLength, queryLength);
		},


		focus: function()
		{
			this.searchBox.focus();
		},


		handleRef: handleRef("searchBox"),


		render: function()
		{
			var props = this.props,
				mode = props.mode,
				query = props.query;

				// we want to show the placeholders only when the user's entered
				// the history or bookmarks mode and the query length is 3, which
				// is /h|b space.  we need to use an Input component that ignores
				// the value prop when it's focused, so that the insertion point
				// position isn't lost if the user moves it from the end and
				// starts typing.  that change is forced when the app gets an
				// esc and clears the text.
			return <div>
				<Input type="search"
					ref={this.handleRef}
					className="search-box"
					tabIndex="0"
					placeholder="Search for a tab title or URL, or type / for more options"
					spellCheck={false}
					autoFocus={true}
					value={query}
					forceUpdate={props.forceUpdate}
					onChange={props.onChange}
					onKeyDown={props.onKeyDown}
					onKeyUp={props.onKeyUp}
				/>
				{mode == "bookmarks" && query.length == 3 &&
					<Placeholder mode={mode} shortcut="/b" text="Search for a bookmark title or URL" />}
				{mode == "history" && query.length == 3 &&
					<Placeholder mode={mode} shortcut="/h" text="Search for a title or URL from the browser history" />}
				{mode == "command" &&
					<Placeholder mode={mode} shortcut="/b" text="Type b for bookmark search or h for history, then a space" />}
			</div>
		}
	});


	return SearchBox;
});
