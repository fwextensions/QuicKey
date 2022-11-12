import React from "react";


// this class was based on this GitHub comment: https://github.com/facebook/react/issues/955#issuecomment-281802381


export default class Input extends React.Component {
    static defaultProps = {
        onChange: function() {},
        onFocus: function() {},
        onBlur: function() {}
    };


	static getDerivedStateFromProps(
		props,
		state)
	{
			// the parent can pass forceUpdate to force the input's value
			// to change even if it's focused
		if (!state.isFocused || props.forceUpdate) {
			return { currentValue: props.value };
		} else {
			return null;
		}
	}


    state = {
        isFocused: false,
        currentValue: this.props.value
    };
    input = null;


    componentDidUpdate()
	{
			// wait until after the component has updated so that there's
			// text to be selected
		if (this.props.selectAll && this.input) {
			this.input.select();
		}
	}


	focus()
	{
		if (this.input) {
			this.input.focus();
		}
	}


	setSelectionRange(
		start,
		end)
	{
		if (this.input) {
			this.input.setSelectionRange(start, end);
		}
	}


	handleRef = (
		input) =>
	{
		this.input = input;
	};


    handleChange = (
		e) =>
	{
		this.setState({ currentValue: e.target.value });
		e.persist();
		this.props.onChange(e);
	};


    handleFocus = (
		e) =>
	{
		this.setState({ isFocused: true });
		e.persist();
		this.props.onFocus(e);
	};


    handleBlur = (
		e) =>
	{
		this.setState({ isFocused: false });
		e.persist();
		this.props.onBlur(e);
	};


    render()
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
}
