export interface ThemePalette {
  id: string;
  label: string;
  dot: string;
  ink: string;
  muted: string;
  soft: string;
  softAlt: string;
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  lime: string;
  purple: string;
  coral: string;
  border: string;
  strongBorder: string;
  pageBg: string;
  heroBackdrop: string;
  heroBg: string;
  cardTint: string;
  cardAlt: string;
  activeGradient: string;
  shadow: string;
  glow: string;
}

export const themePalettes: ThemePalette[] = [
  {
    id: "cool",
    label: "蓝绿",
    dot: "#38BDF8",
    ink: "#172033",
    muted: "#5E6B7A",
    soft: "#E6F7FF",
    softAlt: "#E9FFF8",
    primary: "#38BDF8",
    primaryDark: "#036E94",
    secondary: "#2DD4BF",
    accent: "#8B5CF6",
    lime: "#B9F36B",
    purple: "#8B5CF6",
    coral: "#6D5DF6",
    border: "rgba(56,189,248,0.28)",
    strongBorder: "rgba(56,189,248,0.4)",
    pageBg: "linear-gradient(135deg, #F5FCFF 0%, #E6F7FF 48%, #EFFFFB 100%)",
    heroBackdrop:
      "radial-gradient(circle at 18% 16%, rgba(185,243,107,0.34), transparent 28%), radial-gradient(circle at 84% 18%, rgba(139,92,246,0.16), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.34), rgba(245,252,255,0.72))",
    heroBg: "linear-gradient(145deg, #FFFFFF 0%, #E8F8FF 50%, #F1FFF9 100%)",
    cardTint: "#ECFEFF",
    cardAlt: "#F8FEFF",
    activeGradient: "linear-gradient(135deg, #38BDF8, #2DD4BF)",
    shadow: "0 24px 80px rgba(20,117,150,0.14)",
    glow: "rgba(56,189,248,0.28)",
  },
  {
    id: "gold",
    label: "暖黄",
    dot: "#EBC257",
    ink: "#2F2617",
    muted: "#746747",
    soft: "#FFF4C9",
    softAlt: "#FFF9DF",
    primary: "#EBC257",
    primaryDark: "#9B6A16",
    secondary: "#F3D37A",
    accent: "#E99468",
    lime: "#EFE28D",
    purple: "#B58EDC",
    coral: "#EF8A68",
    border: "rgba(235,194,87,0.34)",
    strongBorder: "rgba(235,194,87,0.48)",
    pageBg: "linear-gradient(135deg, #FFFDF3 0%, #FFF0B7 50%, #FFF8DE 100%)",
    heroBackdrop:
      "radial-gradient(circle at 18% 16%, rgba(255,235,153,0.52), transparent 28%), radial-gradient(circle at 84% 18%, rgba(239,138,104,0.14), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,250,226,0.76))",
    heroBg: "linear-gradient(145deg, #FFFFFF 0%, #FFECA7 52%, #FFF9DC 100%)",
    cardTint: "#FFF4C9",
    cardAlt: "#FFFDF3",
    activeGradient: "linear-gradient(135deg, #EBC257, #EF8A68)",
    shadow: "0 24px 80px rgba(153,106,22,0.14)",
    glow: "rgba(235,194,87,0.3)",
  },
  {
    id: "green",
    label: "暖绿",
    dot: "#A8C686",
    ink: "#253326",
    muted: "#65745F",
    soft: "#EEF6E8",
    softAlt: "#E7F3EC",
    primary: "#A8C686",
    primaryDark: "#526E48",
    secondary: "#86AFA0",
    accent: "#7FAE9A",
    lime: "#C9DDB8",
    purple: "#9F95BE",
    coral: "#8FB7A6",
    border: "rgba(168,198,134,0.36)",
    strongBorder: "rgba(168,198,134,0.5)",
    pageBg: "linear-gradient(135deg, #F8FBF7 0%, #EEF6E8 52%, #E2F1E7 100%)",
    heroBackdrop:
      "radial-gradient(circle at 18% 16%, rgba(168,198,134,0.3), transparent 28%), radial-gradient(circle at 84% 18%, rgba(134,175,160,0.18), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.46), rgba(238,246,232,0.76))",
    heroBg: "linear-gradient(145deg, #FFFFFF 0%, #EEF6E8 52%, #E7F3EC 100%)",
    cardTint: "#EEF6E8",
    cardAlt: "#F8FBF7",
    activeGradient: "linear-gradient(135deg, #A8C686, #86AFA0)",
    shadow: "0 24px 80px rgba(82,110,72,0.13)",
    glow: "rgba(168,198,134,0.28)",
  },
];

export const defaultPalette = themePalettes[0];
