import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

/** Last-resort public UI when unexpected configuration or browser state breaks rendering. */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  declare readonly props: Readonly<AppErrorBoundaryProps>;
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-[#D4CDA4] text-[#15150F] grid place-items-center p-6 font-mono">
          <section className="max-w-xl border-2 border-[#15150F] bg-[#E2DCB9] p-6 shadow-[8px_8px_0px_#15150F]" role="alert">
            <h1 className="text-xl font-bold">PORTFOLIO INTERFACE UNAVAILABLE</h1>
            <p className="mt-3 text-sm leading-relaxed">
              An unexpected display error occurred. Reload the page; if it continues, use a published contact channel.
            </p>
            <button className="mt-5 border-2 border-[#15150F] bg-[#C3E54E] px-4 py-2 text-xs font-bold" onClick={() => window.location.reload()}>
              RELOAD INTERFACE
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
