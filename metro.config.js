// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/*
 * The cross-reference graph ships as a packed binary (assets/bible/xrefs.bin),
 * not as JSON. Metro only bundles extensions it knows are assets, so without
 * this it would try to parse 3MB of CSR arrays as JavaScript.
 *
 * Binary matters here rather than being a micro-optimisation: the same graph
 * as JSON is roughly four times the size and has to be parsed into ordinary
 * JS objects at startup, which is exactly the cost a 2GB phone cannot pay.
 */
config.resolver.assetExts.push('bin');

module.exports = config;
