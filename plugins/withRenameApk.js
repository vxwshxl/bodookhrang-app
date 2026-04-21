const { withAppBuildGradle } = require('expo/config-plugins');

const withRenameApk = (config, customName) => {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      // Avoid adding multiple times if plugin runs more than once
      if (!config.modResults.contents.includes('outputFileName =')) {
        config.modResults.contents += `
android.applicationVariants.all { variant ->
    variant.outputs.all { output ->
        outputFileName = "${customName}.apk"
    }
}

tasks.whenTaskAdded { task ->
    if (task.name.startsWith("bundle")) {
        task.doLast {
            def bundleDir = file("$buildDir/outputs/bundle/\${task.name.replace('bundle', '').toLowerCase()}")
            def oldFile = new File(bundleDir, "app-\${task.name.replace('bundle', '').toLowerCase()}.aab")
            def newFile = new File(bundleDir, "${customName}.aab")
            if (oldFile.exists()) {
                oldFile.renameTo(newFile)
            }
        }
    }
}
`;
      }
    }
    return config;
  });
};

module.exports = withRenameApk;
