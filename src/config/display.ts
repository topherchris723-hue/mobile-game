/** All gameplay drawing happens in a logical space this many units tall; width follows the screen aspect. */
export const LOGICAL_HEIGHT = 720;

/** Devices report up to 3–4× pixel density; rendering above 2× costs fill-rate with no visible gain. */
export const MAX_RENDER_RESOLUTION = 2;

/** Background canvases are painted once per resize; cap their pixel size to bound texture memory. */
export const MAX_BACKDROP_TEXTURE_WIDTH = 2560;
