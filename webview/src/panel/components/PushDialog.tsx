import { useCallback, useEffect, useRef, useState } from "react";

export interface PushDialogProps {
  branchName: string;
  onClose: () => void;
  onPush: (force: boolean) => Promise<void>;
}

export function PushDialog({ branchName, onClose, onPush }: PushDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const handlePush = useCallback(
    async (force: boolean) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        await onPush(force);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [onPush],
  );

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.4)",
      }}
    >
      <div
        style={{
          background: "var(--vscode-editorWidget-background, #252526)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "16px 20px",
          minWidth: 340,
          maxWidth: 460,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--app-fg)",
          }}
        >
          ⚠️ Force Push Branch
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 12,
            color: "var(--description-fg)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Force Push branch '{branchName}' to remote 'origin'.
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "var(--vscode-button-secondaryBackground, #3a3d41)",
              color: "var(--vscode-button-secondaryForeground, var(--app-fg))",
              border: "none",
              borderRadius: 4,
              padding: "4px 14px",
              fontSize: 12,
              height: 28,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handlePush(true)}
            disabled={submitting}
            style={{
              background: "transparent",
              color: "var(--vscode-errorForeground, #f48771)",
              border: "1px solid var(--vscode-errorForeground, #f48771)",
              borderRadius: 4,
              padding: "4px 14px",
              fontSize: 12,
              height: 28,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.5 : 1,
              fontWeight: 500,
            }}
          >
            Force Push
          </button>
        </div>
      </div>
    </div>
  );
}
