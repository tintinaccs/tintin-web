export const SHELL_VERSION = 'tintin-20260811-cls-header-reserve-1';
export const HEADER_BRAND_VERSION = 'tintin-20260817-header-logo-mobilebar-1';

export const BREAKPOINTS = Object.freeze({
  mobileMax: 767,
  tabletMin: 768,
  tabletMax: 1024,
  desktopMin: 1025,
});

const SITE_ROOT_URL = new URL('../../../../', import.meta.url);
const JS_ROOT_URL = new URL('../../../', import.meta.url);

export function versionedSiteAsset(path, version = SHELL_VERSION) {
  const url = new URL(path, SITE_ROOT_URL);
  url.searchParams.set('v', version);
  return url.href;
}

export function versionedJsModule(path, version = SHELL_VERSION) {
  const url = new URL(path, JS_ROOT_URL);
  url.searchParams.set('v', version);
  return url.href;
}

export function logoUrl() {
  return versionedSiteAsset('assets-tintin/images/general/logo.png');
}
