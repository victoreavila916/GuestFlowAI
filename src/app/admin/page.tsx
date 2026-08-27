"use client";

import { useState } from "react";

type Property = {
  id: number;
  name: string;
  address: string;
  wifi_name: string;
  check_in: string;
  check_out: string;
  house_rules: string;
  emergency_contact: string;
};

export default function AdminPage() {
  const [property, setProperty] = useState<Property | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function importPropertyPDF(file: File) {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Property import failed.");
      }

      setProperty(data.property);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Something went wrong while importing the property."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "Arial, sans-serif" }}>
      <p style={{ margin: 0, color: "#4f7a61", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        GuestFlow Admin
      </p>
      <h1 style={{ margin: "10px 0 8px", fontSize: 32 }}>Import a property</h1>
      <p style={{ margin: 0, color: "#59645d", lineHeight: 1.55 }}>
        Upload the completed GuestFlow property-information PDF. We’ll read the form, create a new property in Supabase, and make the guide ready for guest questions.
      </p>

      <section style={{ marginTop: 32, padding: 24, border: "1px solid #d8e1d8", borderRadius: 16, background: "#fbfdf9" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Property information PDF</h2>
        <p style={{ margin: "8px 0 20px", color: "#677269", fontSize: 14, lineHeight: 1.5 }}>
          Each upload creates a separate property row with its own Supabase-generated ID.
        </p>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 10, background: "#1e4b3a", color: "white", cursor: uploading ? "not-allowed" : "pointer", fontWeight: 700, opacity: uploading ? 0.65 : 1 }}>
          {uploading ? "Importing property…" : "Upload property PDF"}
          <input
            type="file"
            accept="application/pdf"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) await importPropertyPDF(file);
              event.target.value = "";
            }}
          />
        </label>
        {error && <p role="alert" style={{ margin: "16px 0 0", color: "#b42318" }}>{error}</p>}
      </section>

      {property && (
        <section style={{ marginTop: 24, padding: 24, border: "1px solid #b9d4bd", borderRadius: 16, background: "#f1f8f1" }}>
          <p style={{ margin: 0, color: "#27723a", fontSize: 13, fontWeight: 700 }}>✓ Property imported</p>
          <h2 style={{ margin: "8px 0 4px", fontSize: 22 }}>{property.name}</h2>
          <p style={{ margin: "0 0 18px", color: "#52665a" }}>Supabase property ID: <strong>{property.id}</strong></p>
          <dl style={{ display: "grid", gridTemplateColumns: "minmax(110px, auto) 1fr", gap: "10px 16px", margin: 0, fontSize: 14 }}>
            <dt style={{ color: "#536159" }}>Address</dt><dd style={{ margin: 0 }}>{property.address || "—"}</dd>
            <dt style={{ color: "#536159" }}>Wi-Fi</dt><dd style={{ margin: 0 }}>{property.wifi_name || "—"}</dd>
            <dt style={{ color: "#536159" }}>Check-in</dt><dd style={{ margin: 0 }}>{property.check_in || "—"}</dd>
            <dt style={{ color: "#536159" }}>Check-out</dt><dd style={{ margin: 0 }}>{property.check_out || "—"}</dd>
            <dt style={{ color: "#536159" }}>Emergency</dt><dd style={{ margin: 0 }}>{property.emergency_contact || "—"}</dd>
          </dl>
        </section>
      )}
    </main>
  );
}
