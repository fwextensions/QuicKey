import React from "react";
	// this class was based on this GitHub comment: https://github.com/facebook/react/issues/955#issuecomment-281802381


	var Input = React.createClass({
		input: null,


		getDefaultProps: function()
		{
			return {
				onChange: function() {},
				onFocus: function() {},
				onBlur: function() {}
			};
		},


		getInitialState: function()
		{
			return {
				isFocused: false,
				currentValue: this.props.value
			};
		},


		componentWillReceiveProps: function(nextProps)
		{
				// the parent can pass forceUpdate to force the input's value
				// to change even if it's focused
			if (!this.state.isFocused || nextProps.forceUpdate) {
				this.setState({ currentValue: nextProps.value });
			}
		},


		componentDidUpdate: function()
		{
				// wait until after the component has updated so that there's
				// text to be selected
			if (this.props.selectAll && this.input) {
				this.input.select();
			}
		},


		focus: function()
		{
			if (this.input) {
				this.input.focus();
			}
		},


		setSelectionRange: function(start, end)
		{
			if (this.input) {
				this.input.setSelectionRange(start, end);
			}
		},


		handleRef: function(input)
		{
			this.input = input;
		},


		handleChange: function(e)
		{
			this.setState({ currentValue: e.target.value });
			e.persist();
			this.props.onChange(e);
		},


		handleFocus: function(e)
		{
			this.setState({ isFocused: true });
			e.persist();
			this.props.onFocus(e);
		},


		handleBlur: function(e)
		{
			this.setState({ isFocused: false });
			e.persist();
			this.props.onBlur(e);
		},


		render: function()
		{
			const {selectAll, forceUpdate, ...inputProps} = this.props;

			return <input
				{...inputProps}
				ref={this.handleRef}
				value={this.state.currentValue}
				onChange={this.handleChange}
				onFocus={this.handleFocus}
				onBlur={this.handleBlur}
			/>;
		}
	});


	export default Input;

