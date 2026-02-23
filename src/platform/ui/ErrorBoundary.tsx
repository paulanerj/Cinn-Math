
import React, { Component, ErrorInfo, ReactNode } from "react";

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
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h2>
            <p className="text-gray-300 mb-6">
              An unexpected error occurred. We've logged the issue and are working on a fix.
            </p>
            {this.state.error && (
              <div className="bg-black/50 p-4 rounded-lg mb-6 overflow-auto max-h-40">
                <code className="text-xs text-red-300 font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <div className="flex gap-4">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Reload Game
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
