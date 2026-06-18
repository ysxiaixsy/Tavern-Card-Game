/**
 * Card def id → bundled image. Populated by `npm run gen:art`, which scans the
 * (gitignored) assets/cards/ folder. Committed EMPTY so the repo builds with no
 * art (programmatic frames). After running gen:art the file is rewritten with
 * require()s pointing at the gitignored WebP art — that local copy is kept out
 * of git via `git update-index --skip-worktree src/ui/cardArt.ts` (the CDPR
 * images are private / non-distributed).
 *
 * Any defId without an entry falls back to the programmatic CardView frame.
 */
export const CARD_ART: Record<string, number> = {};
