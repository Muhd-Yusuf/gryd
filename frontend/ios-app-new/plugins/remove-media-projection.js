const { withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

function withRemoveMediaProjectionManifest(config) {
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
}

function withExcludeScreenSharing(config) {
    return withAppBuildGradle(config, (config) => {
        const contents = config.modResults.contents;

        // Exclude the Agora screen-sharing module that injects FOREGROUND_SERVICE_MEDIA_PROJECTION
        // This prevents the dependency from being included in the build at all
        if (!contents.includes('exclude group: \'io.agora.rtc\', module: \'full-screen-sharing\'')) {
            // Add a configurations block to exclude the screen-sharing module
            const excludeBlock = `
configurations.all {
    exclude group: 'io.agora.rtc', module: 'full-screen-sharing'
}
`;
            // Insert after the android { } block closes — find the dependencies block
            if (contents.includes('dependencies {')) {
                config.modResults.contents = contents.replace(
                    'dependencies {',
                    excludeBlock + '\ndependencies {'
                );
            } else {
                // Append at end if no dependencies block found
                config.modResults.contents = contents + '\n' + excludeBlock;
            }
        }

        return config;
    });
}

module.exports = function removeMediaProjection(config) {
    config = withRemoveMediaProjectionManifest(config);
    config = withExcludeScreenSharing(config);
    return config;
};
