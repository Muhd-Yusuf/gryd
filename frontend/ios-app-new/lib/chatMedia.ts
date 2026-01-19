export type Attachment = {
    type: 'emoji' | 'sticker' | 'audio' | 'image' | 'file';
    value: string;
    label?: string;
    mimeType?: string;
    durationMs?: number;
    uri?: string;
};

export type EmojiOption = {
    id: string;
    code: string;
    label: string;
};

export type StickerOption = {
    id: string;
    label: string;
    uri: string;
};

export const EMOJI_SET: EmojiOption[] = [
    { id: 'grin', code: '1f600', label: 'Grin' },
    { id: 'smile', code: '1f642', label: 'Smile' },
    { id: 'joy', code: '1f602', label: 'Joy' },
    { id: 'wink', code: '1f609', label: 'Wink' },
    { id: 'sunglasses', code: '1f60e', label: 'Cool' },
    { id: 'heart-eyes', code: '1f60d', label: 'Hearts' },
    { id: 'thinking', code: '1f914', label: 'Thinking' },
    { id: 'party', code: '1f973', label: 'Party' },
    { id: 'fire', code: '1f525', label: 'Fire' },
    { id: 'clap', code: '1f44f', label: 'Clap' },
    { id: 'sparkles', code: '2728', label: 'Sparkles' },
    { id: 'thumbs-up', code: '1f44d', label: 'Thumbs up' },
];

export const STICKER_SET: StickerOption[] = [
    { id: 'bot-1', label: 'Bot 1', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-1' },
    { id: 'bot-2', label: 'Bot 2', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-2' },
    { id: 'bot-3', label: 'Bot 3', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-3' },
    { id: 'bot-4', label: 'Bot 4', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-4' },
    { id: 'bot-5', label: 'Bot 5', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-5' },
    { id: 'bot-6', label: 'Bot 6', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-6' },
    { id: 'bot-7', label: 'Bot 7', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-7' },
    { id: 'bot-8', label: 'Bot 8', uri: 'https://api.dicebear.com/7.x/bottts/png?seed=bot-8' },
];

export const twemojiUrl = (code: string) =>
    `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/${code}.png`;

export const formatDuration = (durationMs?: number) => {
    if (!durationMs) return '';
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const formatRelativeTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (seconds < 60) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    if (weeks < 4) return `${weeks}w`;

    // For older dates, show formatted date like "Dec 9"
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const formatMessageDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    if (isYesterday) {
        return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};
