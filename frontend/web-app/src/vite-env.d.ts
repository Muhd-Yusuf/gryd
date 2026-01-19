/// <reference types="vite/client" />

interface CommunityEmbedElement extends HTMLElement {
    setConfig: (config: import('./embed/communityEmbed').CommunityEmbedConfig) => void;
    refreshToken: () => Promise<void>;
}

declare namespace JSX {
    interface IntrinsicElements {
        'syphor-community-embed': React.DetailedHTMLProps<React.HTMLAttributes<CommunityEmbedElement>, CommunityEmbedElement>;
    }
}
