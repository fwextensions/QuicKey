# To do

- why is Facebook only 4th match for "face"
	with the contacts-linkedin-reports tab open, "cale" now has the calendar as
		the 5th result
	typing "cal", it doesn't even appear at all
	maybe something about scoring the tab objects directly is causing it?
	ama matches AOL Mail first, despite the amazon.com pages
	jiveon puts the Takoyaki board first, before jiveon.com pages 

- option to match bookmarks, too

- highlight matching characters?
 
- maybe do shift enter to reload suspended tab

- check for 32x32 default document favicon on Mac Retina

- indicate that tab was suspended
	favicon is already greyed out, so maybe don't need it

- time out typed text and then start over? 


# Done

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

