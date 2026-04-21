import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="error-boundary">
        <div className="error-boundary-card">
          <h2>Something went wrong</h2>
          <p className="error-boundary-message">{this.state.error.message}</p>
          <p className="error-boundary-hint">
            Your projects and images are safe — they're stored separately. Try reloading the app.
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="ghost" onClick={this.reset}>
              Try again
            </button>
            <button type="button" className="primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </section>
    );
  }
}
