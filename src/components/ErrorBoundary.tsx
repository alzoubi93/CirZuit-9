import React from "react";

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("CirZuit runtime error", error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-red-500/30 bg-slate-900 p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-red-300">CirZuit encountered a runtime error</h1>
          <p className="mt-2 text-sm text-slate-400">The editor was kept from rendering a blank screen. Open the browser console for the full stack trace.</p>
          <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-red-200 whitespace-pre-wrap">{this.state.error.stack || this.state.error.message}</pre>
          <button className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm hover:bg-red-500/30" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
