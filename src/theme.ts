/**
 * Paleta y medidas compartidas por la pantalla principal y sus componentes.
 * Mantiene la identidad navy/coral de Bible Lens y suma un amarillo cálido
 * para las citas resaltadas.
 */

export const colors = {
  background: "#f4f5f9",
  surface: "#ffffff",
  ink: "#1a1a2e",
  navy: "#16213e",
  blue: "#0f3460",
  accent: "#e94560",
  highlight: "#ffe6a7",
  highlightText: "#4a3500",
  muted: "#6b7280",
  faint: "#9ca3af",
  border: "#e5e7eb",
  borderStrong: "#d5d9e6",
  warningBg: "#fff3cd",
  warningText: "#856404",
  danger: "#b42318",
  dangerBg: "#fdecea",
  shareBg: "#eef1f7",
  onDark: "#ffffff",
  accentSoft: "#fff5f7",
  surfaceMuted: "#fafbff",
  sermon: "#7c3aed",
  backdrop: "rgba(0,0,0,0.45)",
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
} as const;
