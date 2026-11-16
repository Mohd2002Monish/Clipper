const { withAndroidManifest, withDangerousMod, createRunOncePlugin } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for Android Floating Instagram Quick-Clipper
 * - Injects SYSTEM_ALERT_WINDOW and BIND_ACCESSIBILITY_SERVICE into AndroidManifest.xml
 * - Copies native Kotlin services, layouts, drawables, and accessibility configs into the android project
 */
function withInstagramClipper(config) {
  // 1. Android Manifest Updates
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissionsToAdd = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    ];

    permissionsToAdd.forEach((perm) => {
      const exists = manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === perm
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    });

    // Ensure services array exists
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // 1. FloatingOverlayService
    const overlayServiceExists = mainApplication.service.some(
      (s) => s.$ && s.$['android:name'] === '.FloatingOverlayService'
    );
    if (!overlayServiceExists) {
      mainApplication.service.push({
        $: {
          'android:name': '.FloatingOverlayService',
          'android:foregroundServiceType': 'specialUse',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });

  // 2. Copy Native Kotlin Files & Resources during Prebuild
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidAppRoot = path.join(config.modRequest.platformProjectRoot, 'app');

      const javaDir = path.join(
        androidAppRoot,
        'src',
        'main',
        'java',
        'com',
        'mohd4monish',
        'videotimmer'
      );
      const resDir = path.join(androidAppRoot, 'src', 'main', 'res');

      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(path.join(resDir, 'xml'), { recursive: true });
      fs.mkdirSync(path.join(resDir, 'drawable'), { recursive: true });
      fs.mkdirSync(path.join(resDir, 'layout'), { recursive: true });
      fs.mkdirSync(path.join(resDir, 'values'), { recursive: true });

      const sourceBase = path.join(projectRoot, 'android-modules');

      // Copy Kotlin files
      const srcDir = path.join(sourceBase, 'src');
      if (fs.existsSync(srcDir)) {
        fs.readdirSync(srcDir).forEach((file) => {
          fs.copyFileSync(path.join(srcDir, file), path.join(javaDir, file));
        });
      }

      // Copy XML resources
      const copyDirRecursive = (src, dest) => {
        if (!fs.existsSync(src)) return;
        fs.readdirSync(src).forEach((item) => {
          const sPath = path.join(src, item);
          const dPath = path.join(dest, item);
          if (fs.lstatSync(sPath).isDirectory()) {
            fs.mkdirSync(dPath, { recursive: true });
            copyDirRecursive(sPath, dPath);
          } else {
            fs.copyFileSync(sPath, dPath);
          }
        });
      };

      copyDirRecursive(path.join(sourceBase, 'res'), resDir);

      // Register Package in MainApplication.kt / MainApplication.java
      const mainAppKotlin = path.join(javaDir, 'MainApplication.kt');
      if (fs.existsSync(mainAppKotlin)) {
        let content = fs.readFileSync(mainAppKotlin, 'utf8');
        if (!content.includes('FloatingClipperPackage()')) {
          if (content.includes('return PackageList(this).packages')) {
            content = content.replace(
              'return PackageList(this).packages',
              'val packages = PackageList(this).packages.toMutableList()\n            packages.add(FloatingClipperPackage())\n            return packages'
            );
          } else if (content.includes('PackageList(this).packages.apply')) {
            content = content.replace(
              /PackageList\(this\)\.packages\.apply\s*\{/,
              'PackageList(this).packages.apply {\n            add(FloatingClipperPackage())'
            );
          }
          fs.writeFileSync(mainAppKotlin, content, 'utf8');
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = createRunOncePlugin(
  withInstagramClipper,
  'withInstagramClipper',
  '1.0.0'
);

