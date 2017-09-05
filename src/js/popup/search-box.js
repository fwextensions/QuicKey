define([
	"react"
], function(
	React
) {
	function Placeholder(
		props)
	{
		var id = props.mode + "-placeholder";

		return <div id={id} className="command-placeholder">
			<b>/{props.shortcut}</b> {props.text}
		</div>
	}


	var SearchBox = React.createClass({
		componentDidMount: function()
		{
			var searchBox = this.refs.searchBox,
				queryLength = this.props.query.length;

				// even if there's a default value, the insertion point gets set
				// to the beginning of the input field, instead of at the end.
				// so move it there after the field is created.
			searchBox.setSelectionRange(queryLength, queryLength);
		},


		render: function()
		{
			var props = this.props,
				query = props.query;

				// we want to show the placeholders only when the user's entered
				// the history or bookmarks mode and the query length is 3, which
				// is /h|b space
			return <div>
				<input type="search"
					ref="searchBox"
					className="search-box"
					tabIndex="0"
					placeholder="Search for a tab title or URL"
					spellCheck={false}
					autoFocus={true}
					value={query}
					onChange={props.onChange}
					onKeyDown={props.onKeyDown}
				/>
				{props.mode == "bookmarks" && query.length == 3 &&
					<Placeholder mode={props.mode} shortcut="b" text="Search for a bookmark title or URL" />}
				{props.mode == "history" && query.length == 3 &&
					<Placeholder mode={props.mode} shortcut="h" text="Search for a title or URL from the browser history" />}
			</div>
		}
	});


	return SearchBox;
});
