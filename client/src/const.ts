export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginHref = () =>
  `/api/oauth/start?origin=${encodeURIComponent(window.location.origin)}`;

// For automatic redirects and existing callers. Visible controls use normal
// anchors so entering login does not depend on a JavaScript event handler.
export const startLogin = () => {
  window.location.assign(getLoginHref());
};
