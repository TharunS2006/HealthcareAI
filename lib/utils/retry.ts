/**
 * Retry utility with exponential backoff
 * @module utils/retry
 */

import { logger } from '@/lib/logger';

export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxRetries: number;

    /** Initial delay before first retry (ms) */
    initialDelay: number;

    /** Maximum delay between retries (ms) */
    maxDelay: number;

    /** Backoff strategy */
    backoff: 'exponential' | 'linear';

    /** Function to determine if error is retryable */
    shouldRetry?: (error: unknown) => boolean;

    /** Callback after each retry attempt */
    onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoff: 'exponential',
};

/**
 * Retry an async operation with exponential backoff
 * 
 * @example
 * ```typescript
 * const data = await retry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 5, backoff: 'exponential' }
 * );
 * ```
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: unknown;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Check if we should retry this error
            if (opts.shouldRetry && !opts.shouldRetry(error)) {
                throw error;
            }

            // Don't retry if this was the last attempt
            if (attempt >= opts.maxRetries) {
                break;
            }

            // Calculate delay
            const delay = opts.backoff === 'exponential'
                ? Math.min(opts.initialDelay * Math.pow(2, attempt), opts.maxDelay)
                : Math.min(opts.initialDelay * (attempt + 1), opts.maxDelay);

            logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries}`, {
                error: error instanceof Error ? error.message : String(error),
                delayMs: delay,
            });

            // Callback
            opts.onRetry?.(attempt + 1, error);

            // Wait before retry
            await sleep(delay);
        }
    }

    logger.error('All retry attempts failed', {
        maxRetries: opts.maxRetries,
        error: lastError instanceof Error ? lastError.message : String(lastError),
    });

    throw lastError;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Network error retry predicate
 */
export function isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    if (error instanceof Error) {
        const networkErrors = ['network', 'timeout', 'abort', 'ECONNREFUSED'];
        return networkErrors.some(msg => error.message.toLowerCase().includes(msg));
    }

    return false;
}
