import React from "react";

/* ─── Label ─────────────────────────────────────────────── */
export function Label({ children, required, className = "", style = {} }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 4,
        ...style
      }}
      className={className}
    >
      {children}
      {required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
    </label>
  );
}

/* ─── Input ─────────────────────────────────────────────── */
export function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  error,
  style = {},
  className = "",
  autoComplete = "off",
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      style={{
        width: '100%',
        padding: 8,
        borderRadius: 6,
        border: error ? '1.5px solid #ef4444' : '1px solid #ddd',
        fontSize: 13,
        outline: 'none',
        boxShadow: error ? '0 0 0 1px #ef4444' : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        ...style
      }}
      className={className}
      {...props}
    />
  );
}

/* ─── Select ────────────────────────────────────────────── */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  required,
  error,
  style = {},
  className = "",
  ...props
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      required={required}
      style={{
        width: '100%',
        padding: 8,
        borderRadius: 6,
        border: error ? '1.5px solid #ef4444' : '1px solid #ddd',
        fontSize: 13,
        outline: 'none',
        background: '#fff',
        boxShadow: error ? '0 0 0 1px #ef4444' : 'none',
        ...style
      }}
      className={className}
      {...props}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((opt, i) => (
        <option key={i} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

/* ─── SectionHeader ─────────────────────────────────────── */
export function SectionHeader({ children, number, className = "", style = {} }) {
  return (
    <h4
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style
      }}
      className={className}
    >
      {number && (
        <span style={{
          background: 'var(--brand-primary, #f97316)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 4
        }}>
          {number}
        </span>
      )}
      {children}
    </h4>
  );
}

/* ─── Card Section ──────────────────────────────────────── */
export function CardSection({ children, className = "", style = {} }) {
  return (
    <div
      style={{
        padding: 20,
        borderBottom: '1px solid #f3f4f6',
        ...style
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/* ─── FieldGroup ────────────────────────────────────────── */
export function FieldGroup({
  children,
  columns = 1,
  gap = 20,
  className = "",
  style = {}
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/* ─── ActionButton ──────────────────────────────────────── */
export function ActionButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  fullWidth,
  className = "",
  style = {},
  ...props
}) {
  const variants = {
    primary: { background: 'var(--brand-primary, #f97316)', color: '#fff', border: 'none' },
    secondary: { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' },
    danger: { background: '#ef4444', color: '#fff', border: 'none' },
    success: { background: '#10b981', color: '#fff', border: 'none' },
    info: { background: '#3b82f6', color: '#fff', border: 'none' },
    ghost: { background: 'transparent', color: '#374151', border: '1px solid #e5e7eb' }
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, height: 32 },
    md: { padding: '10px 16px', fontSize: 13, height: 38 },
    lg: { padding: '14px 24px', fontSize: 16, height: 50 }
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 8,
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.7 : 1,
        width: fullWidth ? '100%' : 'auto',
        transition: 'all 0.2s',
        ...v,
        ...s,
        ...style
      }}
      className={className}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid currentColor', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite'
          }} />
          {children}
        </span>
      ) : children}
    </button>
  );
}

/* ─── Toast (re-export from context) ────────────────────── */
export { useToast } from "../../context/ToastContext";
export { ToastProvider } from "../../context/ToastContext";