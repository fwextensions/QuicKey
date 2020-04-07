    // just require these modules without using them so that they get included
    // in the common/base module during the build
define([
    "lodash",
    "bluebird",
    "cp",
    "shared",
	"background/constants",
	"background/quickey-storage",
	"background/settings",
	"background/recent-tabs",
	"background/page-trackers",
], () => {});
