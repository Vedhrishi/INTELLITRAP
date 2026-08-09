import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/** Dark-themed boundary that catches render errors in the authenticated app. */
export class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("DashboardErrorBoundary caught an error", error, info);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This section hit an unexpected error. You can try again without losing your session.
          </p>
          <Button className="mt-6" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
}
