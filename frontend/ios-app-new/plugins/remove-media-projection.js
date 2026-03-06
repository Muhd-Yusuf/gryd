const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function removeMediaProjection(config) {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults.manifest;

        // Remove FOREGROUND_SERVICE_MEDIA_PROJECTION permission
        if (manifest['uses-permission']) {
            manifest['uses-permission'] = manifest['uses-permission'].filter(
                (perm) =>
                    perm.$['android:name'] !==
                    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
            );
        }

        return config;
    });
};
