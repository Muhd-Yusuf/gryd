const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function removeMediaProjection(config) {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults.manifest;

        // Ensure tools namespace is declared for tools:node="remove"
        manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

        // Remove FOREGROUND_SERVICE_MEDIA_PROJECTION from existing permissions
        if (manifest['uses-permission']) {
            manifest['uses-permission'] = manifest['uses-permission'].filter(
                (perm) =>
                    perm.$['android:name'] !==
                    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION'
            );
        }

        // Add it back with tools:node="remove" to block manifest merger from re-adding it
        if (!manifest['uses-permission']) {
            manifest['uses-permission'] = [];
        }
        manifest['uses-permission'].push({
            $: {
                'android:name': 'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
                'tools:node': 'remove',
            },
        });

        // Remove any services with foregroundServiceType containing "mediaProjection"
        const application = manifest.application?.[0];
        if (application?.service) {
            application.service = application.service.filter((service) => {
                const fgsType = service.$?.['android:foregroundServiceType'] || '';
                return !fgsType.includes('mediaProjection');
            });
        }

        return config;
    });
};
