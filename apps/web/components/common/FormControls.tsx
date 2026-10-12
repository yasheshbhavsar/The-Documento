import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function TextInput({
  label,
  id,
  error,
  helperText,
  required,
  className = "",
  style,
  ...props
}: InputProps) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : `input-${Math.random().toString(36).substring(2, 7)}`);
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "13px",
            fontWeight: 650,
            color: "var(--text, #0f172a)",
          }}
        >
          {label} {required && <span style={{ color: "var(--critical, #b91c1c)" }}>*</span>}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        style={{
          padding: "8px 12px",
          fontSize: "14px",
          border: `1px solid ${error ? "var(--critical, #b91c1c)" : "var(--border, #e2e8f0)"}`,
          borderRadius: "var(--radius-sm, 8px)",
          background: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          outline: "none",
          transition: "border-color 0.15s ease",
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{ fontSize: "12px", color: "var(--critical, #b91c1c)", fontWeight: 500 }}
        >
          {error}
        </span>
      )}
      {!error && helperText && (
        <span id={helperId} style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>
          {helperText}
        </span>
      )}
    </div>
  );
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { label: string; value: string }[];
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function SelectInput({
  label,
  id,
  options,
  error,
  helperText,
  required,
  style,
  ...props
}: SelectProps) {
  const inputId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, "-")}` : `select-${Math.random().toString(36).substring(2, 7)}`);
  const errorId = `${inputId}-error`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "13px",
            fontWeight: 650,
            color: "var(--text, #0f172a)",
          }}
        >
          {label} {required && <span style={{ color: "var(--critical, #b91c1c)" }}>*</span>}
        </label>
      )}
      <select
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        style={{
          padding: "8px 12px",
          fontSize: "14px",
          border: `1px solid ${error ? "var(--critical, #b91c1c)" : "var(--border, #e2e8f0)"}`,
          borderRadius: "var(--radius-sm, 8px)",
          background: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          outline: "none",
          cursor: "pointer",
          ...style,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} role="alert" style={{ fontSize: "12px", color: "var(--critical, #b91c1c)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export function TextareaInput({
  label,
  id,
  error,
  helperText,
  required,
  style,
  ...props
}: TextareaProps) {
  const inputId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, "-")}` : `textarea-${Math.random().toString(36).substring(2, 7)}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: "13px", fontWeight: 650, color: "var(--text, #0f172a)" }}
        >
          {label} {required && <span style={{ color: "var(--critical, #b91c1c)" }}>*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        aria-invalid={!!error}
        style={{
          padding: "8px 12px",
          fontSize: "14px",
          border: `1px solid ${error ? "var(--critical, #b91c1c)" : "var(--border, #e2e8f0)"}`,
          borderRadius: "var(--radius-sm, 8px)",
          background: "var(--surface, #ffffff)",
          color: "var(--text, #0f172a)",
          minHeight: "80px",
          outline: "none",
          fontFamily: "inherit",
          ...style,
        }}
        {...props}
      />
      {error && (
        <span role="alert" style={{ fontSize: "12px", color: "var(--critical, #b91c1c)" }}>
          {error}
        </span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: "12px", color: "var(--quiet, #64748b)" }}>{helperText}</span>
      )}
    </div>
  );
}

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export function CheckboxInput({ label, description, id, ...props }: CheckboxProps) {
  const inputId = id || `checkbox-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <input
        type="checkbox"
        id={inputId}
        style={{
          marginTop: "3px",
          width: "16px",
          height: "16px",
          cursor: "pointer",
        }}
        {...props}
      />
      <div>
        <label
          htmlFor={inputId}
          style={{ fontSize: "13px", fontWeight: 600, color: "var(--text, #0f172a)", cursor: "pointer" }}
        >
          {label}
        </label>
        {description && (
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--quiet, #64748b)" }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
