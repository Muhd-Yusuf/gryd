import type { CommunityEmbedConfig } from './communityEmbed';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
    class CommunityEmbedElement extends HTMLElement {
        setConfig: (config: CommunityEmbedConfig) => void;
        refreshToken: () => Promise<void>;
    }

    namespace JSX {
        interface IntrinsicElements {
            'syphor-community-embed': DetailedHTMLProps<HTMLAttributes<CommunityEmbedElement>, CommunityEmbedElement>;
        }
    }
}

export {};
