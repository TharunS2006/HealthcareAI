/**
 * React Error Boundary Component
 * Catches errors in component tree and displays fallback UI
 * Modern Medcare Style
 * @module components/shared/ErrorBoundary
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import Icon from '@/components/gov/Icon';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        logger.error('React Error Boundary caught error', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        this.props.onError?.(error, errorInfo);
    }

    private handleReset = (): void => {
        this.setState({
            hasError: false,
            error: null,
        });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-6 bg-bg-page">
                    <div className="bg-white rounded-lg p-8 max-w-lg w-full text-center space-y-6 shadow-card border border-border-subtle">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <Icon name="warning" className="w-8 h-8 text-status-red" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                System Encountered an Error
                            </h2>
                            <p className="text-gray-500 text-sm">
                                The application encountered an unexpected state. Our team has been notified.
                            </p>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <div className="bg-gray-50 rounded-lg p-4 text-left border border-gray-200">
                                <p className="text-sm font-mono text-status-red mb-2 font-bold">
                                    {this.state.error.message}
                                </p>
                                <pre className="text-xs text-gray-600 overflow-auto max-h-40 font-mono">
                                    {this.state.error.stack}
                                </pre>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 py-3 bg-emerald-deep text-white font-semibold rounded-xl hover:bg-emerald-800 transition-all shadow-md shadow-emerald-deep/10"
                            >
                                Reload Module
                            </button>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="flex-1 py-3 bg-white border border-border-active text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                Return Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
