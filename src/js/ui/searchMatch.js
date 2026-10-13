/**
 * One way of searching for every search box on the site (round 76, the
 * owner: "it must be %like% and case-insensitive -- if I search 'mag', the
 * magnetic events show up; everywhere, in between words, anywhere").
 *
 * - Case does not matter: "MAG", "mag" and "Mag" are the same.
 * - Accents and marks do not matter: "oumuamua" finds 'Oumuamua, "haumea"
 *   Haumea, "churyumov-g" finds Churyumov–Gerasimenko (any dash is a "-").
 * - Each word typed is looked for anywhere -- inside a word as well as at
 *   its start ("netic" finds magnetic) -- and every word has to be there,
 *   in any order: "storm magnetic" finds "A magnetic shield in a storm".
 */
export function searchKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ʻʼǃǁǂ'’`]/g, "")
    .replace(/[‐‑‒–—―]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** The words of a query, ready for matches(); empty for a blank query. */
export function searchTerms(query) {
  return searchKey(query).split(" ").filter(Boolean);
}

/** True when every term is somewhere in the text (already a searchKey, or raw). */
export function matches(text, terms) {
  const key = searchKey(text);
  return terms.every((term) => key.includes(term));
}
