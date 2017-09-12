define([
	"react"
], function(
	React
) {
	// this class was based on this GitHub comment: https://github.com/facebook/react/issues/955#issuecomment-281802381


	var Input = React.createClass({
		input: null,


		getDefaultProps()
		{
			return {
				onChange() {},
				onFocus() {},
				onBlur() {}
			};
		},


		getInitialState()
		{
			return {
				isFocused: false,
				currentValue: this.props.value
			};
		},


		componentWillReceiveProps(nextProps)
		{
				// the parent can pass forceUpdate to force the input's value
				// to change even if it's focused
	if (!this.state.isFocused || nextProps.forceUpdate) {
		this.setState({ currentValue: nextProps.value });
	}
		},


		setSelectionRange(start, end)
		{
			if (this.input) {
				this.input.setSelectionRange(start, end);
			}
		},


		handleRef(input)
		{
			this.input = input;
		},


		handleChange(e)
		{
			this.setState({ currentValue: e.target.value });
			e.persist();
			this.props.onChange(e);
		},


		handleFocus(e)
		{
			this.setState({ isFocused: true });
			e.persist();
			this.props.onFocus(e);
		},


		handleBlur(e)
		{
			this.setState({ isFocused: false });
			e.persist();
			this.props.onBlur(e);
		},


		render()
		{
			return <input
				{...this.props}
				ref={this.handleRef}
				value={this.state.currentValue}
				onChange={this.handleChange}
				onFocus={this.handleFocus}
				onBlur={this.handleBlur}
			/>;
		}
	});


	return Input;
});
