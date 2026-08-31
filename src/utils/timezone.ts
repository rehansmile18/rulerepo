/**
 * IANA time zone validation.
 *
 * Time zone strings have been stored unvalidated up to now, which defers the error: an
 * unrecognised zone is accepted at write time and only fails later, inside date arithmetic, where
 * it reads as a processing fault rather than a configuration mistake.
 *
 * `Intl.supportedValuesOf("timeZone")` is used rather than a hardcoded list so the set tracks the
 * runtime's own tzdata (417 zones on the current Node) instead of going stale. Aliases that Intl
 * accepts but omits from that list (e.g. "US/Pacific") still pass, via the constructor check.
 */
const SUPPORTED = new Set<string>(Intl.supportedValuesOf("timeZone"));

export function isValidTimeZone(value: string): boolean {
  if (SUPPORTED.has(value)) return true;
  try {
    // Throws RangeError for anything the runtime can't resolve, including deprecated aliases.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * True for a real ISO 4217 code.
 *
 * Checked against `Intl.supportedValuesOf("currency")` (162 codes) rather than by constructing an
 * Intl.NumberFormat: that constructor accepts ANY well-formed three-letter string — "XYZ" and
 * "ZZZ" both succeed — so it validates the shape and nothing else, which would have let a typo
 * through as a currency.
 */
const SUPPORTED_CURRENCIES = new Set<string>(Intl.supportedValuesOf("currency"));

export function isValidCurrency(value: string): boolean {
  return SUPPORTED_CURRENCIES.has(value);
}
