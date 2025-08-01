import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <h2 className="font-semibold mb-2">Error Details:</h2>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
            <div className="bg-gray-100 p-4 rounded">
              <h2 className="font-semibold mb-2">Component Stack:</h2>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack || 'No component stack available'}
              </pre>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;