export type EmbedTokenProvider = () => Promise<string>;

export type CommunityEmbedConfig = {
    subgridId: string;
    baseUrl?: string;
    tokenProvider?: EmbedTokenProvider;
    refreshIntervalMs?: number;
    theme?: 'light' | 'dark';
    readonly?: boolean;
};

const ELEMENT_NAME = 'syphor-community-embed';
const DEFAULT_REFRESH_MS = 10 * 60 * 1000;

class CommunityEmbedElement extends HTMLElement {
    private config: CommunityEmbedConfig | null = null;
    private token: string | null = null;
    private refreshTimer: number | null = null;
    private lastRefreshAt: string | null = null;

    connectedCallback() {
        this.render();
        this.startTokenRefresh();
    }

    disconnectedCallback() {
        this.stopTokenRefresh();
    }

    setConfig(config: CommunityEmbedConfig) {
        this.config = config;
        this.render();
        this.startTokenRefresh();
    }

    async refreshToken() {
        if (!this.config?.tokenProvider) {
            return;
        }

        try {
            const token = await this.config.tokenProvider();
            this.token = token;
            this.lastRefreshAt = new Date().toLocaleTimeString();
            this.render();
        } catch {
            this.token = null;
            this.lastRefreshAt = 'refresh failed';
            this.render();
        }
    }

    private startTokenRefresh() {
        this.stopTokenRefresh();
        if (!this.config?.tokenProvider) {
            return;
        }
        void this.refreshToken();
        const interval = this.config.refreshIntervalMs ?? DEFAULT_REFRESH_MS;
        this.refreshTimer = window.setInterval(() => {
            void this.refreshToken();
        }, interval);
    }

    private stopTokenRefresh() {
        if (this.refreshTimer) {
            window.clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    private render() {
        const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });

        const theme = this.config?.theme === 'dark' ? 'dark' : 'light';
        const subgridId = this.config?.subgridId ?? 'unknown';
        const readonlyLabel = this.config?.readonly ? 'Read-only' : 'Full access';
        const lastRefresh = this.lastRefreshAt ? `Last token refresh: ${this.lastRefreshAt}` : 'Token not loaded';

        const iframeSrc = this.config?.baseUrl
            ? `${this.config.baseUrl.replace(/\/$/, '')}/embed/${subgridId}${this.token ? `?token=${this.token}` : ''}`
            : '';

        const showIframe = Boolean(this.config?.baseUrl);

        shadow.innerHTML = `
            <style>
                :host { display: block; font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif; }
                .shell { border: 1px solid #E5E7EB; border-radius: 16px; overflow: hidden; background: ${theme === 'dark' ? '#111827' : '#FFFFFF'}; color: ${theme === 'dark' ? '#F9FAFB' : '#111827'}; }
                .header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #E5E7EB; background: ${theme === 'dark' ? '#1F2937' : '#F9FAFB'}; }
                .title { font-size: 14px; font-weight: 700; }
                .meta { font-size: 11px; color: ${theme === 'dark' ? '#D1D5DB' : '#6B7280'}; }
                .body { display: grid; grid-template-columns: 160px 1fr; min-height: 240px; }
                .channels { border-right: 1px solid #E5E7EB; padding: 12px; background: ${theme === 'dark' ? '#111827' : '#FFFFFF'}; }
                .channels h4 { font-size: 11px; margin: 0 0 8px; color: ${theme === 'dark' ? '#9CA3AF' : '#6B7280'}; text-transform: uppercase; letter-spacing: 0.08em; }
                .channel { padding: 6px 8px; border-radius: 8px; font-size: 12px; margin-bottom: 4px; background: ${theme === 'dark' ? '#1F2937' : '#F3F4F6'}; }
                .messages { padding: 12px; }
                .message { border: 1px solid ${theme === 'dark' ? '#374151' : '#E5E7EB'}; border-radius: 12px; padding: 10px; margin-bottom: 8px; }
                .message strong { display: block; font-size: 12px; margin-bottom: 4px; }
                .message p { font-size: 11px; margin: 0; color: ${theme === 'dark' ? '#D1D5DB' : '#374151'}; }
                .footer { display: flex; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #E5E7EB; font-size: 11px; color: ${theme === 'dark' ? '#9CA3AF' : '#6B7280'}; }
                .refresh { border: 1px solid #E5E7EB; background: ${theme === 'dark' ? '#1F2937' : '#FFFFFF'}; padding: 4px 10px; border-radius: 999px; font-size: 11px; cursor: pointer; color: inherit; }
                iframe { border: none; width: 100%; height: 420px; }
            </style>
            <div class="shell">
                <div class="header">
                    <div>
                        <div class="title">Subgrid ${subgridId}</div>
                        <div class="meta">${readonlyLabel}</div>
                    </div>
                    <button class="refresh" id="refresh-btn">Refresh token</button>
                </div>
                ${showIframe ? `<iframe src="${iframeSrc}" title="Syphor Community Embed"></iframe>` : `
                    <div class="body">
                        <div class="channels">
                            <h4>Embed Offline</h4>
                            <div class="channel">Set baseUrl to render the embedded subgrid.</div>
                        </div>
                        <div class="messages">
                            <div class="message"><strong>No data</strong><p>Embed content loads from the live subgrid.</p></div>
                        </div>
                    </div>
                `}
                <div class="footer">
                    <span>${lastRefresh}</span>
                    <span>${this.token ? 'Token active' : 'Token missing'}</span>
                </div>
            </div>
        `;

        const refreshButton = shadow.querySelector<HTMLButtonElement>('#refresh-btn');
        if (refreshButton) {
            refreshButton.onclick = () => {
                void this.refreshToken();
            };
        }
    }
}

export const registerCommunityEmbed = () => {
    if (!customElements.get(ELEMENT_NAME)) {
        customElements.define(ELEMENT_NAME, CommunityEmbedElement);
    }
};
