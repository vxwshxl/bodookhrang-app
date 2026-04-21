const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withRenameApk(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      config.modResults.contents += `
android.applicationVariants.all { variant ->
    variant.outputs.all { output ->
        outputFileName = "bodookhrang.apk"
    }
}
// For AAB:
// It's trickier to rename the AAB via Gradle directly because it doesn't use the outputs API in the same way.
`;
    }
    return config;
  });
};
