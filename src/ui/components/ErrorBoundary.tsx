/**
 * The one place a thrown render error lands.
 *
 * Without this, an exception anywhere in the review form unmounts the
 * whole tree and the user sees a blank page — with their draft still in
 * localStorage and no way to reach it. With it, the message says what
 * happened, the draft is safe, and Start over is one click away.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The only console output the app ever produces on purpose. There is
    // no telemetry to send it to, by design, so it goes where the user can
    // copy it from.
    console.error("Resume → Portfolio crashed:", error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rf">
        <div className="rf-banner rf-banner-issue" style={{ margin: "1.5rem" }} role="alert">
          <div>
            <strong>Something went wrong.</strong> Your draft is still saved in this browser; reloading
            the page will bring it back. If it keeps happening, Start over clears the draft.
            <div className="rf-hint" style={{ marginTop: "0.4rem" }}>
              <code>{this.state.error.message}</code>
            </div>
          </div>
          <button type="button" className="rf-btn rf-btn-small" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className="rf-btn rf-btn-small"
            onClick={() => {
              this.props.onReset();
              this.setState({ error: null });
            }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }
}
