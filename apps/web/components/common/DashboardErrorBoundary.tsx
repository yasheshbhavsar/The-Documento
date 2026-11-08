"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

export interface DashboardErrorBoundaryProps {
  children: ReactNode;
  sectionTitle?: string;
  sectionDescription?: string;
  variant?: "full-tab" | "card" | "table" | "inline";
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  fallbackRender?: (props: {
    error: Error;
    resetErrorBoundary: () => void;
    sectionTitle?: string;
  }) => ReactNode;
  isolateStateKey?: string | number;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  prevIsolateKey?: string | number;
}

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      prevIsolateKey: props.isolateStateKey,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    props: DashboardErrorBoundaryProps,
    state: DashboardErrorBoundaryState
  ): Partial<DashboardErrorBoundaryState> | null {
    // Automatically reset error boundary if the navigation or tab isolate key changes
    if (props.isolateStateKey !== undefined && props.isolateStateKey !== state.prevIsolateKey) {
      return {
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
        prevIsolateKey: props.isolateStateKey,
      };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(
      `[DashboardErrorBoundary: ${this.props.sectionTitle || "Component"}]`,
      error,
      errorInfo
    );
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (loggingErr) {
        console.error("[DashboardErrorBoundary Logging Error]", loggingErr);
      }
    }
  }

  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
          sectionTitle: this.props.sectionTitle,
        });
      }

      const {
        sectionTitle = "Workspace Section",
        sectionDescription,
        variant = "full-tab",
      } = this.props;
      const isCard = variant === "card";
      const isTable = variant === "table";
      const isInline = variant === "inline";

      return (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="dashboard-error-boundary-fallback"
          style={{
            background: "#FFFFFF",
            border: isCard || isInline ? "1px solid #FECACA" : "1.5px solid #E2E8F0",
            borderRadius: isInline ? "8px" : "14px",
            padding: isInline ? "16px 20px" : isTable ? "32px 24px" : "40px 32px",
            textAlign: isTable || isCard ? "center" : "left",
            boxShadow: isInline ? "none" : "0 4px 20px rgba(6, 60, 61, 0.05)",
            margin: isInline ? "8px 0" : "16px 0",
            maxWidth: isCard || isTable ? "100%" : "840px",
            marginInline: "auto",
            color: "#063C3D",
            fontFamily: "var(--font-sans, Inter, sans-serif)",
          }}
        >
          {/* Header Status Tag */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "20px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              fontSize: "11px",
              fontWeight: 700,
              color: "#B91C1C",
              marginBottom: "12px",
              letterSpacing: "0.04em",
            }}
          >
            <span>⚠️ SECTION FAULT ISOLATED</span>
          </div>

          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: isInline ? "15px" : "18px",
              fontWeight: 750,
              color: "#063C3D",
              letterSpacing: "-0.015em",
            }}
          >
            {sectionTitle} Temporarily Unavailable
          </h3>

          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "13px",
              lineHeight: 1.5,
              color: "#445451",
              maxWidth: "600px",
              marginInline: isTable || isCard ? "auto" : "0",
            }}
          >
            {sectionDescription ||
              "An isolated interface anomaly occurred while rendering this section. Tenant data isolation, active cases, and database records remain completely safe and unaffected."}
          </p>

          {/* Action Recovery Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: isTable || isCard ? "center" : "flex-start",
              marginBottom: "16px",
            }}
          >
            <button
              type="button"
              onClick={this.resetErrorBoundary}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #0D6866 0%, #063C3D 100%)",
                color: "#FFFFFF",
                fontSize: "13px",
                fontWeight: 650,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(6, 60, 61, 0.2)",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              ↻ Reload Section
            </button>

            <button
              type="button"
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "#FFFFFF",
                color: "#64748B",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid #CBD5E1",
                cursor: "pointer",
              }}
            >
              {this.state.showDetails ? "Hide Diagnostic Info ▲" : "Show Diagnostic Info ▼"}
            </button>
          </div>

          {/* Collapsible Diagnostic Trace */}
          {this.state.showDetails && (
            <div
              style={{
                background: "#F8F7F2",
                border: "1px solid #E2E8F0",
                borderRadius: "8px",
                padding: "12px 14px",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#334155",
                textAlign: "left",
                maxHeight: "160px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              <strong>Error:</strong> {this.state.error.message}
              {this.state.errorInfo?.componentStack && (
                <>
                  <div style={{ marginTop: "6px", fontWeight: 700, color: "#64748B" }}>
                    Component Stack:
                  </div>
                  <div>{this.state.errorInfo.componentStack}</div>
                </>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
