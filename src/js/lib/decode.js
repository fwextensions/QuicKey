define(function() {
	return function decode(
		string)
	{
		let result = string;

			// try to use decodeURIComponent() to unescape the ttl param, which
			// sometimes throws if it doesn't like the encoding.  if it does,
			// try unescape(), even though it's deprecated.  if unescape is ever
			// fully removed from Chrome, then the string will just be returned
			// undecoded.
		try {
			result = decodeURIComponent(string);
		} catch (e) {
			try {
				result = unescape(string);
			} catch (e) {}
		}

		return result;
	}
});
