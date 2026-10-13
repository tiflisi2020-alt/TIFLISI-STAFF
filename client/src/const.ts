export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginHref = () => "/login";
export const startLogin = () => {
  if (window.location.pathname !== "/login") window.location.assign("/login");
};
