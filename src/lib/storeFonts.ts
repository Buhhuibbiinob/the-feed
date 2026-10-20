import { Chakra_Petch, Share_Tech_Mono } from "next/font/google";

// The record store's two typefaces: Chakra Petch for the menus, Share
// Tech Mono for labels and readouts. Same arrangement as webFonts.ts -
// downloaded at build, served from this domain - but only referenced by
// the store and its countdown, so nobody else's page downloads them.
// The handwriting on the notebook is Caveat, which webFonts.ts already
// declares site-wide as --f-caveat.

export const fontChakra = Chakra_Petch({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--f-chakra",
});
export const fontShareTech = Share_Tech_Mono({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--f-sharetech",
});

export const STORE_FONT_VARIABLES = `${fontChakra.variable} ${fontShareTech.variable}`;
