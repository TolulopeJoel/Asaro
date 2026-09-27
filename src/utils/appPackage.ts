import * as Application from 'expo-application';

/**
 * The installed package, read at runtime. MUST be used for any intent that
 * names the app: debug builds install as `com.asaro.meditation.dev`, and an
 * intent for a package that isn't installed fails silently.
 */
export const APP_PACKAGE = Application.applicationId ?? 'com.asaro.meditation';
