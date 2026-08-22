/**
 * Chit fund (chitty/kuri) tracking - a rotating savings-and-credit
 * instrument distinct from both a loan and a plain investment: every
 * subscriber pays a fixed monthly contribution into a pool, and each month
 * exactly one subscriber is "prized" (wins the pot), via auction (bidding a
 * discount to win early, which gets split as a dividend among the other
 * subscribers) or lottery (no discount/dividend). Once you've won, you still
 * pay your full contribution for every remaining month.
 *
 * Real chits vary in how exactly the dividend/commission math is structured
 * (whether dividends go to all subscribers or only non-prized ones; whether
 * commission comes out of the pot, the discount, or a flat upfront charge -
 * see the research notes in bugs-and-lessons.md §20), so this deliberately
 * does NOT simulate the auction. Instead it just aggregates the *actual
 * outcomes* the user reports for their own participation each month
 * (contribution paid, dividend received, whether they won and how much) -
 * robust to any specific chit's own rules, since it never has to guess them.
 */

/**
 * Rolls up a chit fund's actual monthly outcomes into a summary: total paid
 * in, total dividends received, whether/when the user won and how much they
 * received, how many months are left, and their net position so far
 * (money received back vs. money paid in - naturally negative before
 * winning, since a chit is a forced-savings-then-lump-sum instrument, not a
 * loan from day one).
 * @param {{ durationMonths: number }} chit
 * @param {{ month: string, contributionPaid: number, dividendReceived: number, isPrizedMonth: boolean, prizeAmountReceived: number }[]} months
 * @returns {{
 *   monthsLogged: number,
 *   monthsRemaining: number,
 *   totalContributed: number,
 *   totalDividends: number,
 *   hasWon: boolean,
 *   prizedMonth: string|null,
 *   prizeAmountReceived: number,
 *   netPosition: number,
 *   isComplete: boolean,
 * }}
 */
export function computeChitFundStatus(chit, months) {
  const monthsLogged = months.length;
  const monthsRemaining = Math.max(0, (chit.durationMonths || 0) - monthsLogged);

  const totalContributed = months.reduce((sum, m) => sum + (m.contributionPaid || 0), 0);
  const totalDividends = months.reduce((sum, m) => sum + (m.dividendReceived || 0), 0);

  const prizedEntry = months.find((m) => m.isPrizedMonth);
  const hasWon = !!prizedEntry;
  const prizedMonth = prizedEntry ? prizedEntry.month : null;
  const prizeAmountReceived = prizedEntry ? (prizedEntry.prizeAmountReceived || 0) : 0;

  const netPosition = (totalDividends + prizeAmountReceived) - totalContributed;
  const isComplete = chit.durationMonths > 0 && monthsLogged >= chit.durationMonths;

  return {
    monthsLogged, monthsRemaining, totalContributed, totalDividends,
    hasWon, prizedMonth, prizeAmountReceived, netPosition, isComplete,
  };
}
