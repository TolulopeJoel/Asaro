const { createRunOncePlugin, withMainApplication } = require('@expo/config-plugins');

/**
 * onnxruntime-react-native ships a legacy `unimodule.json`, so expo-modules-autolinking
 * claims it as an Expo module and React Native autolinking never adds OnnxruntimePackage
 * to PackageList.java. The gradle project still builds (the .so files land in the APK),
 * but NativeModules.Onnxruntime is null at runtime. Register the package by hand.
 */
const IMPORT_LINE = 'import ai.onnxruntime.reactnative.OnnxruntimePackage';
const ADD_LINE = '              add(OnnxruntimePackage())';

function patchMainApplication(contents) {
  if (!contents.includes(IMPORT_LINE)) {
    contents = contents.replace(
      'import expo.modules.ApplicationLifecycleDispatcher',
      `${IMPORT_LINE}\n\nimport expo.modules.ApplicationLifecycleDispatcher`
    );
  }

  if (!contents.includes('add(OnnxruntimePackage())')) {
    contents = contents.replace(
      /(PackageList\(this\)\.packages\.apply \{\n)/,
      `$1${ADD_LINE}\n`
    );
  }

  return contents;
}

const withOnnxruntimePackage = (config) =>
  withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withOnnxruntimePackage only supports a Kotlin MainApplication');
    }

    config.modResults.contents = patchMainApplication(config.modResults.contents);
    return config;
  });

module.exports = createRunOncePlugin(
  withOnnxruntimePackage,
  'withOnnxruntimePackage',
  '1.0.0'
);
module.exports.patchMainApplication = patchMainApplication;
