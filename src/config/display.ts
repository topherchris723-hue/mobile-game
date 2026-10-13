/**
 * Portrait layout: all gameplay drawing happens in a logical space this many units wide;
 * the height follows the screen's aspect ratio (about 1280–1600 units on current phones).
 */
export const LOGICAL_WIDTH = 720;

/** Devices report up to 3–4× pixel density; rendering above 2× costs fill-rate with no visible gain. */
export const MAX_RENDER_RESOLUTION = 2;

/** Background canvases are painted once per resize; cap their longest side to bound texture memory. */
export const MAX_BACKDROP_TEXTURE_SIZE = 2560;
