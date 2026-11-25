/** One `<g>` of an SVG source, by its id, with everything inside it. */
export function group(source: string, id: string) {
  const start = source.indexOf(`<g id="${id}">`);
  if (start < 0) return "";
  const tags = /<g\b|<\/g>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(source); match; match = tags.exec(source)) {
    depth += match[0] === "<g" ? 1 : -1;
    if (depth === 0) return source.slice(start, match.index + 4);
  }
  return "";
}
