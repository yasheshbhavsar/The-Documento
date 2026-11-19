"use client";

import React from "react";
import { WorkspaceProvider, useWorkspace } from "../../lib/context/WorkspaceContext";
import { AuthenticatedWorkspaceShell } from "../../components/layout/AuthenticatedWorkspaceShell";
import { AuthForm } from "../../components/auth/AuthForm";

function WorkspaceRouteInner() {
  const { currentUser, handleLoginSuccess } = useWorkspace();

  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8FAF9",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "460px",
            background: "#FFFFFF",
            border: "1px solid #DCE5E1",
            borderRadius: "16px",
            padding: "28px",
            boxShadow: "0 12px 32px rgba(6, 60, 61, 0.08)",
          }}
        >
          <AuthForm idPrefix="workspace" initialPortal="firm" onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return <AuthenticatedWorkspaceShell />;
}

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceRouteInner />
    </WorkspaceProvider>
  );
}
