/**
 * Structured logging service
 * @module logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
    correlationId?: string;
    userId?: string;
    timestamp?: string;
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';
    private correlationId: string | null = null;

    /**
     * Set correlation ID for tracking related logs
     */
    setCorrelationId(id: string): void {
        this.correlationId = id;
    }

    /**
     * Clear correlation ID
     */
    clearCorrelationId(): void {
        this.correlationId = null;
    }

    /**
     * Format log message with context
     */
    private formatLog(level: LogLevel, message: string, context?: LogContext): object {
        return {
            level,
            message,
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            environment: process.env.NODE_ENV,
            ...context,
        };
    }

    /**
     * Log debug information (development only)
     */
    debug(message: string, context?: LogContext): void {
        if (!this.isDevelopment) return;

        const log = this.formatLog('debug', message, context);
        console.debug(JSON.stringify(log, null, 2));
    }

    /**
     * Log informational messages
     */
    info(message: string, context?: LogContext): void {
        const log = this.formatLog('info', message, context);

        if (this.isDevelopment) {
            console.info(JSON.stringify(log, null, 2));
        } else {
            console.info(JSON.stringify(log));
        }
    }

    /**
     * Log warning messages
     */
    warn(message: string, context?: LogContext): void {
        const log = this.formatLog('warn', message, context);

        if (this.isDevelopment) {
            console.warn(JSON.stringify(log, null, 2));
        } else {
            console.warn(JSON.stringify(log));
        }
    }

    /**
     * Log error messages
     */
    error(message: string, context?: LogContext): void {
        const log = this.formatLog('error', message, context);

        if (this.isDevelopment) {
            console.error(JSON.stringify(log, null, 2));
        } else {
            console.error(JSON.stringify(log));
        }

        // In production, send to error tracking service
        if (!this.isDevelopment && typeof window !== 'undefined') {
            // Sentry integration point
            // captureException(new Error(message), { extra: context });
        }
    }

    /**
     * Log performance metrics
     */
    performance(metricName: string, durationMs: number, context?: LogContext): void {
        this.info(`Performance: ${metricName}`, {
            ...context,
            durationMs,
            metric: metricName,
        });
    }
}

// Singleton instance
export const logger = new Logger();

/**
 * Utility to measure async function performance
 */
export async function measurePerformance<T>(
    name: string,
    fn: () => Promise<T>,
    context?: LogContext
): Promise<T> {
    const start = performance.now();

    try {
        const result = await fn();
        const duration = performance.now() - start;
        logger.performance(name, duration, context);
        return result;
    } catch (error) {
        const duration = performance.now() - start;
        logger.error(`${name} failed after ${duration.toFixed(2)}ms`, {
            ...context,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
