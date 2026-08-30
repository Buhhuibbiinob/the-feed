import {
  Bebas_Neue,
  Caveat,
  DM_Serif_Display,
  Lobster,
  Pixelify_Sans,
  Quicksand,
  Space_Mono,
  VT323,
} from "next/font/google";

// The real typefaces, on top of the system stacks.
//
// Downloaded at build time and served from our own domain by next/font,
// not fetched from Google when somebody opens a page. That matters for
// three reasons: no third party learns who reads this site, no page waits
// on somebody else's server, and a font cannot vanish because a CDN
// changed its mind.
//
// Each one is exposed as a CSS variable rather than a class, because the
// font a page uses is chosen per profile at render time - the variable is
// declared once on <body> and referenced by whichever pair the member
// picked. The browser only downloads the file for a family that actually
// gets used on the page, so having eight available costs eight @font-face
// declarations and one download.
//
// Every one is a single weight. A second weight is a second file for a
// difference nobody notices at this size.

// Every option below is written out in full, with no shared constants or
// spreads. next/font is compiled at build time rather than called at run
// time, so it reads these arguments as literal text: `subsets: [...list]`
// or a `display` variable is rejected outright, which the build catches.

export const fontVT323 = VT323({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-vt323" });
export const fontPixelify = Pixelify_Sans({ subsets: ["latin"], display: "swap", variable: "--f-pixelify" });
export const fontBebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-bebas" });
export const fontLobster = Lobster({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-lobster" });
export const fontCaveat = Caveat({ subsets: ["latin"], display: "swap", variable: "--f-caveat" });
export const fontDMSerif = DM_Serif_Display({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-dmserif" });
export const fontQuicksand = Quicksand({ subsets: ["latin"], display: "swap", variable: "--f-quicksand" });
export const fontSpaceMono = Space_Mono({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-spacemono" });

/** Every variable, for the <body> that declares them. */
export const WEB_FONT_VARIABLES = [
  fontVT323.variable,
  fontPixelify.variable,
  fontBebas.variable,
  fontLobster.variable,
  fontCaveat.variable,
  fontDMSerif.variable,
  fontQuicksand.variable,
  fontSpaceMono.variable,
].join(" ");
