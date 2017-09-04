var score;


function log(
	...values)
{
	if (!define.amd) {
		console.log.apply(console, values);
	}
}


function indent(
	string)
{
	return "        " + string;
}


function clip(
	value)
{
	return value.toPrecision(5);
}


function fill(
	array,
	filler)
{
	for (var i = 0; i < array.length; i++) {
		array[i] = array[i] || filler || " ";
	}

	return array.join("");
}


if (typeof define !== "function") {
	var define = function(module) {
		score = module();
	}
}


define(function() {
// TODO: this misses chars at beginning of string.  but it's only used when matching subsequent chars?
	var WhitespacePattern = /[-/:()<>%._=&\[\]\s]/,
		UpperCasePattern = /[A-Z]/;


	function logRanges(
		searchRange,
		hitMask,
		fullMatchedRange)
	{
		var ranges = [].concat(hitMask),
			matchedRange = [];

		if (searchRange.isValid()) {
			ranges[searchRange.location] = "(";
			ranges[searchRange.max() - 1] = ")";
		}

		addIndexesInRange(matchedRange, fullMatchedRange, "^");

		log(indent(fill(ranges)));
// 		log(indent(fill(matchedRange)));
	}


	function scoreForAbbreviation(
		itemString,
		abbreviation,
		hitMask,
		searchRange,
		abbreviationRange,
		originalAbbreviation,
		fullMatchedRange)
	{
		searchRange = searchRange || new Range(0, itemString.length);
		abbreviationRange = abbreviationRange || new Range(0, abbreviation.length);
		hitMask = hitMask || [];
		originalAbbreviation = originalAbbreviation || abbreviation;
		fullMatchedRange = fullMatchedRange || new Range();
console.log(scoreForAbbreviation.caller);

// 		if (!abbreviation || abbreviationRange.length > searchRange.length) {
// 			return 0;
// 		}
//
// 		if (!abbreviationRange.length) {
// 			return 0.9;
// 		}

		if (!abbreviation || !abbreviationRange.length) {
			return 0.9;
		}

		if (abbreviationRange.length > searchRange.length) {
			return 0;
		}

		for (var i = abbreviationRange.length; i > 0; i--) {
			var abbreviationSubstring = abbreviation.substr(abbreviationRange.location, i),
				matchedRange = rangeOfString(itemString, abbreviationSubstring, searchRange);

			log(abbreviationSubstring);

			if (!matchedRange.isValid()) {
				continue;
			}

// TODO: do we need this?  new code doesn't have it
			if (matchedRange.location + abbreviationRange.length > searchRange.max()) {
				continue;
			}

			if (!fullMatchedRange.isValid()) {
				fullMatchedRange.location = matchedRange.location;
			} else {
				fullMatchedRange.location = Math.min(fullMatchedRange.location, matchedRange.location);
			}

			fullMatchedRange.max(matchedRange.max());

			if (hitMask) {
				addIndexesInRange(hitMask, matchedRange);
			}

// 			log(abbreviationSubstring);
			logRanges(searchRange, hitMask, fullMatchedRange);

			var remainingSearchRange = new Range(matchedRange.max(), searchRange.max() - matchedRange.max()),
				remainingScore = scoreForAbbreviation(itemString, abbreviation, hitMask, remainingSearchRange,
					new Range(abbreviationRange.location + i, abbreviationRange.length - i),
					originalAbbreviation, fullMatchedRange),
				discounter = 1;

			log("remainingScore:", clip(remainingScore));

			if (remainingScore) {
// why does the score get higher the farther into the string it is?
				var stringLengthAfterMatch = remainingSearchRange.location - searchRange.location;
				var fromLastMatchRange = new Range(searchRange.location, stringLengthAfterMatch);
				var score = stringLengthAfterMatch;
				var matchStartPercentage = fullMatchedRange.location / itemString.length;
// 				var score = remainingSearchRange.location - searchRange.location;
				var matches = [];
				var ranges = [];

				addIndexesInRange(ranges, fromLastMatchRange, "+");
				log(indent(fill(ranges, "-")));
				addIndexesInRange(matches, remainingSearchRange, "|");
				addIndexesInRange(matches, new Range(searchRange.location, score), "-");
				log("score:", score);

					// ignore skipped characters if it's first letter of a word
					// this comment doesn't make sense ^^^
				if (matchedRange.location > searchRange.location) { //if some letters were skipped
					var j;

					if ((itemString.length < 101 || matchStartPercentage < .3) && WhitespacePattern.test(itemString.charAt(matchedRange.location - 1))) {
						log("ws", "|" + itemString.charAt(matchedRange.location - 1) + itemString.charAt(matchedRange.location) + "|");

						for (j = matchedRange.location - 2; j >= searchRange.location; j--) {
							if (WhitespacePattern.test(itemString.charAt(j))) {
								matches[j] = "w";
								score--;
							} else {
// this reduces the penalty for skipped chars when we also didn't skip over any other words
								score -= 0.15;
							}
						}
					} else if ((itemString.length < 101 || matchStartPercentage < .3) && UpperCasePattern.test(itemString.charAt(matchedRange.location))) {
						for (j = matchedRange.location - 1; j >= searchRange.location; j--) {
							if (UpperCasePattern.test(itemString.charAt(j))) {
								matches[j] = "u";
								score--;
							} else {
								score -= 0.15;
							}
						}
					} else {
// TODO: switch to / 2 to make it score like the latest Quicksilver
// 						score -= (matchedRange.location - searchRange.location) / 2;
							// reduce the score by the number of chars we've
							// skipped since the beginning of the search range
							// and discount the remainingScore based on how much
							// larger it is than the abbreviation
						score -= matchedRange.location - searchRange.location;
						discounter = originalAbbreviation.length / fullMatchedRange.length;
					}
				}

// 				discounter = 1;
// 				discounter = originalAbbreviation.length / fullMatchedRange.length;
				log(indent(fill(matches)));

// TODO: limiting the multiplier reduces the scores of very long URLs
// 				score += remainingScore * Math.min(remainingSearchRange.length, 50);
				log("score:", score, remainingScore, "remainingSearchRange: " + remainingSearchRange, originalAbbreviation, "fullMatchedRange: " + fullMatchedRange, matchStartPercentage, discounter,
					(1 - (fullMatchedRange.location / itemString.length)));
// 				log("score:", score, remainingScore, remainingSearchRange.length, originalAbbreviation.length, fullMatchedRange.length, originalAbbreviation.length / fullMatchedRange.length);
// 				log("score:", score, remainingScore, remainingSearchRange.length, fromLastMatchRange.length, searchRange.location, remainingSearchRange.length, fromLastMatchRange.length / (searchRange.location + remainingSearchRange.length ));

				score += remainingScore * remainingSearchRange.length * discounter * (1 - (fullMatchedRange.location / itemString.length));
// 				score += remainingScore * remainingSearchRange.length * Math.max(discounter, (1 - (fullMatchedRange.location / itemString.length)));
// 				score += remainingScore * remainingSearchRange.length * discounter;

// 				score += remainingScore * remainingSearchRange.length * (originalAbbreviation.length / fullMatchedRange.length);
// 				score += remainingScore * remainingSearchRange.length * (fromLastMatchRange.length / (searchRange.location + remainingSearchRange.length ));
// 				score += remainingScore * remainingSearchRange.length / fromLastMatchRange.length;
// 				score += remainingScore * remainingSearchRange.length;
				log("score:", score);
				score /= searchRange.length;
				log(clip(score));

				return score;
			}
		}

		return 0;
	}


	//region Range
	function Range(
		location,
		length)
	{
		if (typeof location == "undefined") {
			this.location = -1;
			this.length = 0;
		} else {
			this.location = location;
			this.length = length;
		}
	}


	Range.prototype.max = function(
		max)
	{
		if (typeof max == "number") {
			this.length = max - this.location;
		}

		return this.location + this.length;
	};


	Range.prototype.isValid = function()
	{
		return (this.location > -1);
	};


	Range.prototype.toString = function()
	{
		if (this.location == -1) {
			return "invalid range";
		} else {
			return "[" + this.location + "," + this.max() + ")";
		}
	};


	function rangeOfString(
		string,
		substring,
		searchRange)
	{
		searchRange = searchRange || new Range(0, string.length);

		var stringToSearch = string.substr(searchRange.location, searchRange.length).toLowerCase(),
			subStringIndex = stringToSearch.indexOf(substring.toLowerCase()),
			result = new Range();

		if (subStringIndex > -1) {
			result.location = subStringIndex + searchRange.location;
			result.length = substring.length;
		}

		return result;
	}


	function addIndexesInRange(
		indexes,
		range,
		char)
	{
		for (var i = range.location; i < range.max(); i++) {
			indexes[i] = char || "*";
		}

		return indexes;
	}


	return scoreForAbbreviation;
	//endregion
});



if (!define.amd) {
	(function() {
		//region logScore
		function logScore(
			string,
			query)
		{
			log(indent(string));
			log("\n" + clip(score(string, query)));
			log(new Array(60).join("=") + "\n");
		}


		function obfuscate(
			string,
			query)
		{
			function randomLetter(letters)
			{
				return letters[Math.floor(Math.random() * letters.length)];
			}


			function alphaRange(startChar)
			{
				var chars = [];

				for (var i = 0; i < 26; i++) {
					chars.push(String.fromCharCode(startChar + i));
				}

				return chars;
			}


			const QueryPattern = new RegExp("[" + query + "]", "i"),
					// create arrays of upper and lowercase letters, and filter
					// out any letters in the query
				Uppercase = alphaRange(65).filter(c => !QueryPattern.test(c)),
				Lowercase = alphaRange(97).filter(c => !QueryPattern.test(c)),
				UpperPattern = /[A-Z]/,
				LowerPattern = /[a-z]/,
				NumericPattern = /\d/;

			return string.split("").map(c => QueryPattern.test(c) ? c :
				UpperPattern.test(c) ? randomLetter(Uppercase) :
				LowerPattern.test(c) ? randomLetter(Lowercase) :
				NumericPattern.test(c) ? Math.floor(Math.random() * 10) : c).join("");
		}
		//endregion



		// "[NORRIN-10049] [P1] YCC- UserVoice Norrin - Photo Save Different Between Broswers - JIRA"

		var query = "norr";


// 		logScore("gh.bouncer.login.yahoo.com/login/?remip=66.228.162.44&redirect_reason=YBY_IP_MISMATCH&dso_version=3.0.0.11&dso_timeout=480&url=http://hunk1.flickr.vip.bf1.yahoo.com:4080/hunk/en-US/app/search/search?dispatch.sample_ratio=1&display.general.type=visualizations&display.page.search.mode=fast&display.page.search.tab=visualizations&display.visualizations.charting.chart.stackMode=stacked&q=search%20index%3D%22tripod%22%20source%3D%22%2Fvar%2Flog%2Fspread%2Faccess_log%22%20%222064ac9242f73bdf91d58a11e361d33c%22%20AND%20%22buckets%2F%253Cnull%253E%22%20%7C%20timechart%20span%3D1d%20count%20by%20http_code&earliest=-7d%40h&latest=now&sid=1489448670.1137000_971AA81E-9286-4138-8B7D-AE291C1CBC17", query);
// 		logScore("ch.ioenisr.wojxn.elpoo.tod/tobun/?rxzeh=89.967.925.54&rxfvrtsk_rvweon=ZBJ_PI_DBPTASBB&tgo_dxrlgon=7.8.6.36&ffo_czqlope=604&xrs=xbfi://qunx3.vcdkfr.svf.sz3.vxfoo.aob:5155/ksnv/pn-YL/fbj/qzkrqg/fihrxy?pfkdtqfy.xzbfiw_riwso=5&avwgdbk.vinirza.qpxi=ggwakqqaigwond&zdjcwdy.umts.mxqrti.molh=jbma&jcdbusm.duxz.ltarwz.awi=havcmydbadionj&xxfhief.eqkhxpyxwdgonj.iwqrwknp.szprl.kwmhjSoyy=fwxemax&g=edlril%24jntpt%3F%53erijoc%77%95wowrzy%3I%16%7Kxjr%4Gmoq%8Qzdrwie%9Ylmtwgh_coj%87%20%501340bk8095g72tve54w91y77w305a00w%30%89HNS%55%47hbmzexx%4E%855Bnmzp%579B%88%66%3A%38gbqqxjsrq%83iyqn%4A1d%75qownm%67xi%70gtlq_tokf&gcrhsqck=-0a%32k&fpveql=noy&bbg=8350272699.7413941_313VC29F-5269-7892-8P7K-LL418J6LYE85", query);
// 		logScore("data.mail.yahoo.com/psearch/v2/items?mimeTypes=images&contentProviders=www@yahoo&query=derp&timezoneOffset=420&index=creationTime&order=desc&limit=8&dp=1&timezone=America/Los_Angeles&tzoffset=420&clientid=mailcompose&mailboxid=VjJ-RdUHeiaTXk4EYM6AqhZ9ifn64iDQI8BfhJvRoyDylGCUwz8dlyIYdVKtzbeRMljIyqtsdt-jko-uK0ko8KHOrw&lmv3=1&oldSearchV2Mids=1&mailboxemail=jdunning@yahoo-inc.com&mailboxtype=PARTNER&wssid=/YrI0YcJwA2&ymreqid=ff26f520-3c9b-ccde-016b-cd02af010000&appid=YahooMailNeo&bucketid=CMDNORRINPUSHT05", query);
		logScore("https://gh.bouncer.login.yahoo.com/simplesaml/saml2/idp/SSOService.php?spentityid=mail.splunk.yahoo.com&cookieTime=1496854480&RelayState=cmV0dXJuX3RvPS9lbi1VUy9hcHAvc3BsdW5rX2FwcF9tYWlsc2VhcmNoL3NlYXJjaD9xPXNlYXJjaCUyMGluZGV4JTNEaWR4X2ZlbW9uJTIwaG92ZXJjYXJkX25hbWUlN0UlMkElMEElN0MlMjB0aW1lY2hhcnQlMjBzcGFuJTNEMWQlMjBjb3VudCZkaXNwbGF5LnBhZ2Uuc2VhcmNoLm1vZGU9c21hcnQmZGlzcGF0Y2guc2FtcGxlX3JhdGlvPTEmZWFybGllc3Q9MTQ5NTQzNjQwMCZsYXRlc3Q9MTQ5NjA0MTIwMCZkaXNwbGF5LnBhZ2Uuc2VhcmNoLnRhYj12aXN1YWxpemF0aW9ucyZkaXNwbGF5LmdlbmVyYWwudHlwZT12aXN1YWxpemF0aW9ucyZzaWQ9MTQ5NjcxNjczNC4yNDdfMzEyMzQ0RkYtNUE0NS00QTZBLTgxRTUtODk2OUEzNDM5OUY2JnVzZXJuYW1lPSZhY2NlcHRlZF90b3M9", "nor");

			// this bouncer URL scores higher than the hash maps one
		logScore("gh.bouncer.login.yahoo.com/login/?remip=127.0.0.1&redirect_reason=YBY_IP_MISMATCH&dso_version=3.0.0.13&dso_timeout=0&url=https://gh.bouncer.login.yahoo.com/simplesaml/module.php/bouncerauth/finalize.php?stateID=_3a303f013898eef90708a38c1d775d91cc53f8264b%3Ahttps%3A%2F%2Fgh.bouncer.login.yahoo.com%2Fsimplesaml%2Fsaml2%2Fidp%2FSSOService.php%3Fspentityid%3Dmail.splunk.yahoo.com%26cookieTime%3D1494553544%26RelayState%3DcmV0dXJuX3RvPS9lbi1VUy9hcHAvc3BsdW5rX2FwcF9pcmlzL3NlYXJjaD9zaWQ9MTQ5NDM0NDkwMC4xOTBfMzUwQzE2NzEtQkZFQS00QjdFLTg1MDItRDVDQzJDQzU4MzUxJmRpc3BhdGNoLnNhbXBsZV9yYXRpbz0xJmRpc3BsYXkucGFnZS5zZWFyY2gubW9kZT1zbWFydCZxPXNlYXJjaCUyMGluZGV4JTNEaWR4X2lyaXNfd2ViX21hbmhhdHRhbiUyMGJyb3dzZXItbG9nJmVhcmxpZXN0PS0yNGglNDBoJmxhdGVzdD1ub3cmdXNlcm5hbWU9JmFjY2VwdGVkX3Rvcz0%253D", query);
		logScore("ryanmorr.com/true-hash-maps-in-javascript/?utm_source=javascriptweekly&utm_medium=email", query);
		logScore("Drdvpx ehci on Norrun - Vooqyi Koth", query);

// 		logScore("California Pacific Medical Center - 108 Photos & 232 Reviews - Medical Centers - 3700 California St, Presidio Heights, San Francisco, CA - Phone Number - Yelp", "cpmc");
// 		logScore("docs.google.com/spreadsheets/d/1SYzUEqGLkc6vaG4p-CgCklgCcY3SWdmTiH4GunTcpDI/edit#gid=2013849991", "cpmc");
// 		logScore("Email Testing Tools - HTML Email Testing - Email on Acid", "et");
// 		logScore("Email Testing Tools - HTML Email Testing - Email on Acid", "ett");
// 		logScore("emailonacid.com/email-testing", "ett");

		logScore("gh.bouncer.login.yahoo.com/simplesaml/saml2/idp/SSOService.php?spentityid=mail.splunk.yahoo.com&cookieTime=1494961940&RelayState=cmV0dXJuX3RvPS9lbi1VUy9hcHAvc3BsdW5rX2FwcF9pcmlzL3NlYXJjaD9zaWQ9MTQ5NDM0NDkwMC4xOTBfMzUwQzE2NzEtQkZFQS00QjdFLTg1MDItRDVDQzJDQzU4MzUxJmRpc3BhdGNoLnNhbXBsZV9yYXRpbz0xJmRpc3BsYXkucGFnZS5zZWFyY2gubW9kZT1zbWFydCZxPXNlYXJjaCUyMGluZGV4JTNEaWR4X2lyaXNfd2ViX21hbmhhdHRhbiUyMGJyb3dzZXItbG9nJmVhcmxpZXN0PS0yNGglNDBoJmxhdGVzdD1ub3cmdXNlcm5hbWU9JmFjY2VwdGVkX3Rvcz0=", "qk");
// 		logScore("Quokka.js: Configuration", "qk");
		logScore("prod.splunk.yahoo.com/splunk/en-US/app/splunk_app_mailsearch/search?earliest=-5d@d&latest=now&q=search index=idx_femon credstoreCallback* provider=yahoo\n| timechart span=1d count by status&display.page.search.mode=fast&dispatch.sample_ratio=1&display.general.type=visualizations&display.page.search.tab=visualizations&display.visualizations.charting.chart.stackMode=stacked&sid=1492797632.3904_A6DCB467-E2F1-45D7-8D9F-4B748C701CCC", "qk");
		logScore("quokkajs.com/docs/configuration.html", "qk");
		logScore("FutureQuest, Inc. - Powered by Kayako Resolve Help Desk Software", "qk");


// 		console.log(obfuscate("gh.bouncer.login.yahoo.com/login/?remip=66.228.162.44&redirect_reason=YBY_IP_MISMATCH&dso_version=3.0.0.11&dso_timeout=480&url=http://hunk1.flickr.vip.bf1.yahoo.com:4080/hunk/en-US/app/search/search?dispatch.sample_ratio=1&display.general.type=visualizations&display.page.search.mode=fast&display.page.search.tab=visualizations&display.visualizations.charting.chart.stackMode=stacked&q=search%20index%3D%22tripod%22%20source%3D%22%2Fvar%2Flog%2Fspread%2Faccess_log%22%20%222064ac9242f73bdf91d58a11e361d33c%22%20AND%20%22buckets%2F%253Cnull%253E%22%20%7C%20timechart%20span%3D1d%20count%20by%20http_code&earliest=-7d%40h&latest=now&sid=1489448670.1137000_971AA81E-9286-4138-8B7D-AE291C1CBC17", "norr"));

// 		console.log(obfuscate("Travel view on Norrin - Google Docs", "norr"));
	})();
}