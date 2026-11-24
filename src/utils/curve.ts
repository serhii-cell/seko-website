/**
 * A smooth curve through points given left to right: a monotone cubic
 * (PCHIP), so it bends gently through every point without overshooting
 * between them. One definition gives both the SVG path to draw and the
 * height at any x, so whatever travels along the drawn curve stays on it.
 */
export type Point = [number, number];

export function smoothCurve(points: Point[]) {
  const n = points.length;
  const widths: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    widths.push(points[i + 1][0] - points[i][0]);
    slopes.push((points[i + 1][1] - points[i][1]) / widths[i]);
  }
  /* The tangent at each point: a weighted harmonic mean of the slopes
     either side, flat where the curve turns, one-sided at the ends. */
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0] ?? 0;
    if (i === n - 1) return slopes[n - 2] ?? 0;
    const before = slopes[i - 1];
    const after = slopes[i];
    if (before * after <= 0) return 0;
    const w1 = 2 * widths[i] + widths[i - 1];
    const w2 = widths[i] + 2 * widths[i - 1];
    return (w1 + w2) / (w1 / before + w2 / after);
  });

  /** The curve's height at `x`; past either end it carries straight on. */
  const y = (x: number) => {
    if (x <= points[0][0]) {
      return points[0][1] + tangents[0] * (x - points[0][0]);
    }
    if (x >= points[n - 1][0]) {
      return points[n - 1][1] + tangents[n - 1] * (x - points[n - 1][0]);
    }
    let i = 0;
    while (x > points[i + 1][0]) i++;
    const h = widths[i];
    const t = (x - points[i][0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * points[i][1] +
      (t3 - 2 * t2 + t) * h * tangents[i] +
      (-2 * t3 + 3 * t2) * points[i + 1][1] +
      (t3 - t2) * h * tangents[i + 1]
    );
  };

  /* Each piece as a cubic Bézier with its handles a third of the way
     along, which traces exactly the curve `y` describes. */
  const round = (value: number) => Math.round(value * 100) / 100;
  let path = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const third = widths[i] / 3;
    path += `C${round(x0 + third)} ${round(y0 + tangents[i] * third)} ${round(x1 - third)} ${round(y1 - tangents[i + 1] * third)} ${round(x1)} ${round(y1)}`;
  }

  return { y, path };
}
