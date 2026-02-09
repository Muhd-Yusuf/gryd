/**
 * Content Filter Service
 * Handles detection and filtering of prohibited words/phrases
 */

const Subgrid = require('../models/Subgrid');

/**
 * Check if content contains any prohibited words
 * @param {string} content - The text content to check
 * @param {string[]} prohibitedWords - Array of prohibited words/phrases
 * @returns {{ isClean: boolean, matches: string[], censoredContent: string }}
 */
const checkContent = (content, prohibitedWords) => {
    if (!content || !prohibitedWords || prohibitedWords.length === 0) {
        return { isClean: true, matches: [], censoredContent: content };
    }

    const lowerContent = content.toLowerCase();
    const matches = [];
    let censoredContent = content;

    for (const word of prohibitedWords) {
        if (!word || word.trim() === '') continue;

        const lowerWord = word.toLowerCase().trim();
        const escapedWord = escapeRegex(lowerWord);

        // Check if word starts/ends with word characters to determine boundary matching
        const startsWithWordChar = /^\w/.test(lowerWord);
        const endsWithWordChar = /\w$/.test(lowerWord);

        // Build regex pattern with appropriate boundaries
        // Use word boundary for word chars, lookahead/lookbehind for special chars
        const startBoundary = startsWithWordChar ? '\\b' : '(?:^|[\\s.,!?;:\'"()\\[\\]{}])';
        const endBoundary = endsWithWordChar ? '\\b' : '(?=[\\s.,!?;:\'"()\\[\\]{}]|$)';

        const regex = new RegExp(`${startBoundary}${escapedWord}${endBoundary}`, 'gi');

        if (regex.test(content)) {
            matches.push(word);
            // Reset regex lastIndex for replace
            regex.lastIndex = 0;
            // Censor by replacing with asterisks
            censoredContent = censoredContent.replace(regex, (match) => '*'.repeat(match.length));
        }
    }

    return {
        isClean: matches.length === 0,
        matches,
        censoredContent,
    };
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Filter content based on subgrid moderation settings
 * @param {string} content - The text content to filter
 * @param {string} subgridId - The subgrid ID to get settings from
 * @returns {Promise<{ allowed: boolean, message?: string, censoredContent?: string, flagged?: boolean, matches?: string[] }>}
 */
const filterContent = async (content, subgridId) => {
    try {
        const subgrid = await Subgrid.findById(subgridId).select('contentModeration');

        if (!subgrid || !subgrid.contentModeration?.enabled) {
            return { allowed: true, censoredContent: content };
        }

        const { prohibitedWords, action, blockedMessage } = subgrid.contentModeration;

        if (!prohibitedWords || prohibitedWords.length === 0) {
            return { allowed: true, censoredContent: content };
        }

        const result = checkContent(content, prohibitedWords);

        if (result.isClean) {
            return { allowed: true, censoredContent: content };
        }

        // Content contains prohibited words - apply action
        switch (action) {
            case 'block':
                return {
                    allowed: false,
                    message: blockedMessage || 'Your message contains prohibited content and cannot be sent.',
                    matches: result.matches,
                };

            case 'flag':
                return {
                    allowed: true,
                    flagged: true,
                    censoredContent: content,
                    matches: result.matches,
                };

            case 'censor':
                return {
                    allowed: true,
                    censoredContent: result.censoredContent,
                    matches: result.matches,
                };

            default:
                return { allowed: true, censoredContent: content };
        }
    } catch (error) {
        console.error('[ContentFilterService] Error filtering content:', error);
        // On error, allow content to prevent blocking legitimate messages
        return { allowed: true, censoredContent: content };
    }
};

/**
 * Get content moderation settings for a subgrid
 * @param {string} subgridId - The subgrid ID
 * @returns {Promise<Object>}
 */
const getModerationSettings = async (subgridId) => {
    try {
        const subgrid = await Subgrid.findById(subgridId).select('contentModeration');
        return subgrid?.contentModeration || {
            enabled: true,
            prohibitedWords: [],
            action: 'block',
            blockedMessage: 'Your message contains prohibited content and cannot be sent.',
        };
    } catch (error) {
        console.error('[ContentFilterService] Error getting moderation settings:', error);
        return null;
    }
};

/**
 * Update content moderation settings for a subgrid
 * @param {string} subgridId - The subgrid ID
 * @param {Object} settings - The new settings
 * @returns {Promise<Object>}
 */
const updateModerationSettings = async (subgridId, settings) => {
    try {
        const updateData = {};

        if (settings.enabled !== undefined) {
            updateData['contentModeration.enabled'] = settings.enabled;
        }
        if (settings.prohibitedWords !== undefined) {
            // Clean and deduplicate the words
            const cleanedWords = [...new Set(
                settings.prohibitedWords
                    .map(w => w.trim().toLowerCase())
                    .filter(w => w.length > 0)
            )];
            updateData['contentModeration.prohibitedWords'] = cleanedWords;
        }
        if (settings.action !== undefined) {
            updateData['contentModeration.action'] = settings.action;
        }
        if (settings.blockedMessage !== undefined) {
            updateData['contentModeration.blockedMessage'] = settings.blockedMessage;
        }

        const subgrid = await Subgrid.findByIdAndUpdate(
            subgridId,
            { $set: updateData },
            { new: true }
        ).select('contentModeration');

        return subgrid?.contentModeration;
    } catch (error) {
        console.error('[ContentFilterService] Error updating moderation settings:', error);
        throw error;
    }
};

/**
 * Add prohibited words to a subgrid
 * @param {string} subgridId - The subgrid ID
 * @param {string[]} words - Words to add
 * @returns {Promise<string[]>}
 */
const addProhibitedWords = async (subgridId, words) => {
    try {
        console.log('[ContentFilterService.addProhibitedWords] Input:', { subgridId, words });
        const cleanedWords = words
            .map(w => w.trim().toLowerCase())
            .filter(w => w.length > 0);

        console.log('[ContentFilterService.addProhibitedWords] Cleaned words:', cleanedWords);

        const subgrid = await Subgrid.findByIdAndUpdate(
            subgridId,
            { $addToSet: { 'contentModeration.prohibitedWords': { $each: cleanedWords } } },
            { new: true }
        ).select('contentModeration.prohibitedWords');

        console.log('[ContentFilterService.addProhibitedWords] Updated subgrid:', subgrid);
        return subgrid?.contentModeration?.prohibitedWords || [];
    } catch (error) {
        console.error('[ContentFilterService] Error adding prohibited words:', error);
        throw error;
    }
};

/**
 * Remove prohibited words from a subgrid
 * @param {string} subgridId - The subgrid ID
 * @param {string[]} words - Words to remove
 * @returns {Promise<string[]>}
 */
const removeProhibitedWords = async (subgridId, words) => {
    try {
        const cleanedWords = words.map(w => w.trim().toLowerCase());

        const subgrid = await Subgrid.findByIdAndUpdate(
            subgridId,
            { $pull: { 'contentModeration.prohibitedWords': { $in: cleanedWords } } },
            { new: true }
        ).select('contentModeration.prohibitedWords');

        return subgrid?.contentModeration?.prohibitedWords || [];
    } catch (error) {
        console.error('[ContentFilterService] Error removing prohibited words:', error);
        throw error;
    }
};

module.exports = {
    checkContent,
    filterContent,
    getModerationSettings,
    updateModerationSettings,
    addProhibitedWords,
    removeProhibitedWords,
};
