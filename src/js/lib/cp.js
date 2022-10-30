import { ChromePromise } from "@/lib/chrome-promise";
import shared from "@/lib/shared";


		// store a single ChromePromise instance on the background page, so
		// that if we used optional permissions, the background and popup
		// would have the same permissions
	export default shared("cp", () => new ChromePromise());
