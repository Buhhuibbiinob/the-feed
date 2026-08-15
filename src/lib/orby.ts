// Shared Orby constants.
//
// This lives outside src/app/actions/orby.ts on purpose: that file is a
// "use server" module, and Next.js only allows async functions to be
// exported from one. The client component needs the limit to draw the
// wish dots, so the number has to sit in a plain module both sides import.
export const ORBY_DAILY_LIMIT = 3;
