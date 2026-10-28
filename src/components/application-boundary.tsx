"use client";
import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/** One application can fail without taking down the desktop or other windows. */
export class ApplicationBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="app-error">
          <RefreshCw size={28} strokeWidth={1.2} />
          <h3>This app needs a fresh start.</h3>
          <p>Your saved files are still in your workspace.</p>
          <button
            className="small-button"
            onClick={() => this.setState({ failed: false })}
          >
            Try again <RefreshCw size={13} />
          </button>
        </div>
      );
    return this.props.children;
  }
}
