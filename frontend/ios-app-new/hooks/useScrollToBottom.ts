/**
 * Centralized hook for managing scroll-to-bottom behavior in chat/message screens
 * Works reliably with KeyboardAwareScrollView and regular ScrollView
 */

import { useRef, useCallback } from 'react';
import { ScrollView } from 'react-native';

export interface UseScrollToBottomReturn {
    /** Ref to attach to the ScrollView's innerRef */
    scrollViewRef: React.RefObject<ScrollView>;
    /** Ref for KeyboardAwareScrollView component itself */
    keyboardAwareRef: React.RefObject<any>;
    /** Ref to track if initial scroll should happen */
    shouldScrollToBottomRef: React.MutableRefObject<boolean>;
    /** Call this to scroll to bottom (e.g., after sending a message) */
    scrollToBottom: (animated?: boolean) => void;
    /** Attach this to onContentSizeChange */
    handleContentSizeChange: (contentWidth: number, contentHeight: number) => void;
    /** Attach this to onLayout */
    handleScrollViewLayout: (event: any) => void;
    /** Call this when switching conversations to reset scroll state */
    resetScrollState: () => void;
    /** Mark that initial scroll should happen (call when messages first load) */
    markForInitialScroll: () => void;
}

export const useScrollToBottom = (): UseScrollToBottomReturn => {
    const scrollViewRef = useRef<ScrollView>(null);
    const keyboardAwareRef = useRef<any>(null);
    const shouldScrollToBottomRef = useRef<boolean>(false);
    const contentHeightRef = useRef<number>(0);
    const scrollViewHeightRef = useRef<number>(0);
    const initialScrollDoneRef = useRef<boolean>(false);

    // Scroll to bottom helper - called after sending messages
    const scrollToBottom = useCallback((animated: boolean = true) => {
        // Calculate the scroll position based on content height and visible area
        const scrollTo = contentHeightRef.current - scrollViewHeightRef.current;
        if (scrollTo > 0) {
            requestAnimationFrame(() => {
                scrollViewRef.current?.scrollTo({ y: scrollTo, animated });
            });
        }
    }, []);

    // Handle content size change - track height and scroll on initial load
    const handleContentSizeChange = useCallback((contentWidth: number, contentHeight: number) => {
        contentHeightRef.current = contentHeight;
        // Only scroll on initial load
        if (shouldScrollToBottomRef.current && contentHeight > 0 && scrollViewHeightRef.current > 0) {
            const scrollTo = contentHeight - scrollViewHeightRef.current;
            if (scrollTo > 0) {
                scrollViewRef.current?.scrollTo({ y: scrollTo, animated: false });
            }
            shouldScrollToBottomRef.current = false;
        }
    }, []);

    // Handle layout to get scroll view height
    const handleScrollViewLayout = useCallback((event: any) => {
        scrollViewHeightRef.current = event.nativeEvent.layout.height;
    }, []);

    // Reset scroll state when switching conversations
    const resetScrollState = useCallback(() => {
        initialScrollDoneRef.current = false;
        contentHeightRef.current = 0;
        shouldScrollToBottomRef.current = false;
    }, []);

    // Mark that initial scroll should happen
    const markForInitialScroll = useCallback(() => {
        if (!initialScrollDoneRef.current) {
            shouldScrollToBottomRef.current = true;
            initialScrollDoneRef.current = true;
        }
    }, []);

    return {
        scrollViewRef,
        keyboardAwareRef,
        shouldScrollToBottomRef,
        scrollToBottom,
        handleContentSizeChange,
        handleScrollViewLayout,
        resetScrollState,
        markForInitialScroll,
    };
};

export default useScrollToBottom;
