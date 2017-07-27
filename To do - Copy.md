# To do

- why is Facebook only 4th match for "face"
	with the contacts-linkedin-reports tab open, "cale" now has the calendar as
		the 5th result
	typing "cal", it doesn't even appear at all
	maybe something about scoring the tab objects directly is causing it?
	ama matches AOL Mail first, despite the amazon.com pages
	jiveon puts the Takoyaki board first, before jiveon.com pages 
	inc doesn't list the Yahoo Inc calendar at all
	boo doesn't list the boo<b>yah</b> title at all, but bo does 
	script.html doesn't match the local file
	ke puts this first: chrome-extension://klbibkeccnjlkjkiokjodocebajanakg/suspended.html#uri=https://sierra.secure.force.com/donate/rc_connect__Campaign_DesignForm?id=701i00000014FHjAAM&formCampaignId=701310000008mTgAAI&form=00P3100000SKGIaEAP&data=8e3c29dc68a46a3e517de0a2f615b220f0417b287f4eab0a18034c536fdbcd0e#!form=00P3100000SKGIaEAP
		even for ketab, that's first, and it doesn't match /KeyTab

- option to match bookmarks, too
	maybe closed tabs

- test liquidmetal and qs_score
	// this is crazy slow when it gets to 4 chars
	//	var scoreArray = arrayScore(qsScore.score.bind(qsScore), ["title", "url"]);
		var scoreArray = arrayScore(function(string, text) {
	console.time("score");
			var result = qsScore.score(string, text);
	console.timeEnd("score");
	//		return qsScore.score(string, text);
		}, ["title", "url"]);

- change manifest to not require unsafe eval in the built version
 
- switch to using string.search(new RegExp(char, "i")) to find the indexes
	should be faster, though only takes 0.03ms right now
	but should handle some languages like Turkish better 
	create a function to split the chars and return regexes
	try/catch the creation, so that if an invalid char like [ is part of the string
		it just returns that as a plain string
	or just check for the special chars and return everything else as a regex
	memoize the function  
 
- maybe do shift enter to reload suspended tab

- check for 32x32 default document favicon on Mac Retina

- indicate that tab was suspended
	favicon is already greyed out, so maybe don't need it

- time out typed text and then start over?
 

X
Attribution-Non-Commercial 3.0 Netherlands (help for licenses) http://creativecommons.org/licenses/by-nc/3.0/nl/deed.en_GB
P.J. Onori
http://www.somerandomdude.com/

search
Octicons https://www.iconfinder.com/search/?q=iconset%3Aocticons
http://opensource.org/licenses/MIT


# Done

- doesn't do a good job when there's a strong match on the URL that doesn't appear 
	at all in the title
	
- highlight matching characters?

- show URLs, without protocol, including for chrome-extension://

- add fallback icon for tabs without favicons

- match against URLs

- track mouse  

- handle URLs for suspended tabs

- use favicon as a background image

- use actual tabs array for matching
	support passing key value to score()

- pull the RJS config from require-config.js in grunt
 
- show favicon
	favIconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB0ElEQVQ4T52TQURlURjH/+c4HddzJUnGk1lM9YykoZnF29SmvEWKREREJJlFkoxRizlkVmMk0SbJyCyGaDEqESURSaTWaZGM5i1ez3Vc13GM77xevXcXad63POc7v+////sOW9r9rDg4KikLC0YAVAgAARZ3PqlKphffsIWdGQVbjjDWOE2ci+fZHGDft6aVteWEhtpG5IK/yOo/kEJCQMRnODDnHOzb70lFYRQrMhF62obRkvyA0+sDnF7t4z7Mokp4EDFFFD77ujmuiFQsUiO4xNvke6SbMvA9HydXBVBoNESsl83+GlKcRIonvwQxNgKdN9e/Q2/7CDzpYXnvC+511vUaY2BhwGZ+DiiS7TQ80I2JHKDOT6Ij1Yd0KoNs/harh/MIdN55J9OUD5te71eR0fTaubDWoNZ/ha7WQaTfdOM2d429yw1c3ByDsnpaOgspEmBTP3oVeSsCCDbaOYfXdSlsn63j/OYIkQkhhffYU8jLwiPA5FqP0lH+UT5dkfScvoOOAkguy+5K0kZCVoN9XMsoHRZ8FYo/BMhLFim2ac6qRcKrBptY7VZBmCsBvGyxCeB7NWBjK50qIAX/+aEoUJ8UuAxM8LKxsa6E8PEPxF63Ntm5ir4AAAAASUVORK5CYII="

