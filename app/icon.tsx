import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: "#09090b", // zinc-950
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "20%",
          border: "2px solid #ef4444", // red-500
        }}
      >
        {/* Replicamos el SVG del Isotipo para el favicon/icono */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke="#ef4444" strokeWidth="1.5" />
        </svg>
      </div>
    ),
    { ...size }
  );
}