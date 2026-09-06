const DEAL_PATTERNS = [
  /\bpartnership\b/i,
  /\bcollab(oration)?\b/i,
  /\bsponsor(ed|ship)?\b/i,
  /\bbrand deal\b/i,
  /\bpaid promotion\b/i,
  /\bwork together\b/i,
  /\bmarketing (team|agency)\b/i,
];

/** Cheap, fast heuristic — no AI call needed for this one. */
function looksLikeBrandDeal(messageText) {
  if (!messageText) return false;
  return DEAL_PATTERNS.some((re) => re.test(messageText));
}

module.exports = { looksLikeBrandDeal };
