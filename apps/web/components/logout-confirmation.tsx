"use client";

import { useEffect, useState } from "react";
import { LogOut, X } from "lucide-react";

export function LogoutConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoggingOut) setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isLoggingOut]);

  function handleLogout() {
    setIsLoggingOut(true);
    window.location.assign("/api/auth/logout");
  }

  return (
    <>
      <button
        type="button"
        className="crm-user-settings-btn"
        title="Keluar / Logout"
        aria-label="Keluar / Logout"
        onClick={() => setIsOpen(true)}
      >
        <LogOut size={15} />
      </button>

      {isOpen && (
        <div
          className="crm-logout-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isLoggingOut) setIsOpen(false);
          }}
        >
          <div
            className="crm-logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="crm-logout-close"
              aria-label="Tutup dialog"
              onClick={() => setIsOpen(false)}
              disabled={isLoggingOut}
            >
              <X size={17} />
            </button>

            <img
              className="crm-logout-illustration"
              src="/images/logout-confirmation-3d.png"
              alt="Ilustrasi keluar dari workspace"
            />
            <div className="crm-logout-copy">
              <h2 id="logout-dialog-title">Yakin ingin keluar?</h2>
              <p id="logout-dialog-description">
                Sesi Anda akan diakhiri. Anda bisa masuk kembali kapan saja untuk melanjutkan pekerjaan.
              </p>
            </div>
            <div className="crm-logout-actions">
              <button
                type="button"
                className="crm-logout-cancel"
                onClick={() => setIsOpen(false)}
                disabled={isLoggingOut}
              >
                Batal
              </button>
              <button
                type="button"
                className="crm-logout-confirm"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut size={16} />
                {isLoggingOut ? "Keluar..." : "Keluar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
