import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
export default function PaymentSheet({
  open,
  title,
  onClose,
  busy = false,
  variant = "sheet",
  children,
  footer,
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    function key(e) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onClose?.();
      }
      if (e.key !== "Tab" || !ref.current) return;
      const nodes = [
        ...ref.current.querySelectorAll(
          'button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
        ),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first) {
        e.preventDefault();
        return;
      }
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus?.({ preventScroll: true });
    };
  }, [open, busy, onClose]);
  if (!open) return null;
  return createPortal(
    <div
      className="mlm-plans mlm-sheet-backdrop"
      data-payment-sheet="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`mlm-sheet ${variant === "screen" ? "mlm-sheet-screen" : ""}`}
      >
        <div className="mlm-sheet-handle" />
        <header className="mlm-sheet-heading">
          {variant === "screen" && <button aria-label="Go back" disabled={busy} onClick={onClose} className="mlm-icon-button mlm-screen-back"><ArrowLeft size={22}/></button>}
          <h2>{title}</h2>
          {variant !== "screen" && <button
            aria-label="Close plan details"
            disabled={busy}
            onClick={onClose}
            className="mlm-icon-button"
          >
            <X size={20} />
          </button>}
        </header>
        <div className="mlm-sheet-content">{children}</div>
        {footer && <footer className="mlm-sheet-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
