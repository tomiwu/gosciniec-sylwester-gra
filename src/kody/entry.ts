import { createPackageAppAuth } from "kody:@kentcdodds/package-app-kit/auth";
import { KODY_APP } from "./config";
import { createHandler } from "./handler";

const auth = createPackageAppAuth({ packageName: KODY_APP.packageName });

/** `kody.app.entry`: default-exports the fetch handler. */
export default createHandler({
  resolveUser: (request) => auth.resolveUser(request),
  fetch: (input, init) => fetch(input, init),
});
