/**
 * React Query Provider with Persistence
 *
 * This provider enables native app-like behavior:
 * - Cache persists to AsyncStorage (survives app restarts)
 * - Shows cached data immediately on app launch
 * - Refreshes data in background while showing stale data
 *
 * Like WhatsApp/Instagram - data appears instantly, then updates silently
 */

import React, { ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, asyncStoragePersister } from '../lib/queryClient';

interface QueryProviderProps {
    children: ReactNode;
}

export const QueryProvider: React.FC<QueryProviderProps> = ({ children }) => {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister: asyncStoragePersister,
                // Max age of persisted cache: 7 days
                maxAge: 7 * 24 * 60 * 60 * 1000,
                // Buster to invalidate cache on app updates (change this when data structure changes)
                buster: 'v1',
                // Dehydrate options - which queries to persist
                dehydrateOptions: {
                    shouldDehydrateQuery: (query) => {
                        // Don't persist queries that are fetching or errored
                        if (query.state.status === 'pending') return false;
                        if (query.state.status === 'error') return false;
                        // Persist all successful queries
                        return true;
                    },
                },
            }}
            // Called when cache is restored from storage
            onSuccess={() => {
                // Cache restored - queries will show cached data immediately
                // Then refetch stale data in background
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
};

export default QueryProvider;
