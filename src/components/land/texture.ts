/**
 * What keeps the land from looking like a spreadsheet of coloured squares.
 *
 * Three things, and they are ordered by how much they buy per unit of cost:
 *
 *   **Weathering.** Every cell's colour is nudged a few percent lighter or
 *   darker by a hash of where it is. Real ground is never one flat value, and
 *   a field of 1,189 identical greens reads as a chart no matter what shape it
 *   is cut into. This costs nothing at all — it is arithmetic on a colour that
 *   was being computed anyway — and it does more for realism than everything
 *   below it put together.
 *
 *   **Furrows.** Plough lines at a quarter of a cell, drawn once for the whole
 *   field as a single SVG path rather than as views. A View per line would be
 *   four hundred extra nodes on a screen that already has twelve hundred.
 *
 *   **Clods and growth.** A scatter of specks: darker on bare earth, lighter
 *   on planted ground. Also one path, and also seeded by position so a field
 *   looks the same every time it is opened. Ground that reshuffles itself
 *   between visits is not a place.
 *
 * Everything here is deterministic. There is no `Math.random` in this file and
 * there must never be one: the land is somewhere the reader is meant to come
 * to recognise, and recognition needs the stones to stay where they were.
 */

/** A stable 0..1 from an integer seed. Cheap, and good enough for dirt. */
export function noise(seed: number): number {
    let value = (seed ^ 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ (value >>> 15), 0x85ebca6b) >>> 0;
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
    return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

function channels(hex: string): [number, number, number] {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const toHex = (r: number, g: number, b: number) =>
    `#${[r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')}`;

/** A hex at a given transparency, for drawing over ground you cannot predict. */
export function rgba(hex: string, alpha: number): string {
    const [r, g, b] = channels(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * `top` laid over `bottom` at `alpha`, resolved to a solid colour.
 *
 * Done here rather than left to the renderer as an rgba background so that the
 * result can then be weathered. A translucent colour cannot be nudged — the
 * nudge would land on whatever happened to be underneath.
 */
export function blend(top: string, bottom: string, alpha: number): string {
    const [tr, tg, tb] = channels(top);
    const [br, bg, bb] = channels(bottom);
    return toHex(
        tr * alpha + br * (1 - alpha),
        tg * alpha + bg * (1 - alpha),
        tb * alpha + bb * (1 - alpha),
    );
}

/**
 * The same colour, a few percent off, decided by position.
 *
 * `spread` is a fraction: 0.12 means the ground varies over roughly a twelfth
 * either way. Much more than that and the field starts to look mouldy rather
 * than weathered; much less and it may as well be flat.
 */
export function weather(hex: string, seed: number, spread = 0.11): string {
    const factor = 1 - spread / 2 + noise(seed) * spread;
    const [r, g, b] = channels(hex);
    return toHex(r * factor, g * factor, b * factor);
}

/**
 * Plough lines across the whole field, as one path.
 *
 * Horizontal, at a pitch that divides the cell evenly, so the lines land on
 * chapter boundaries as well as inside them — the texture reinforces the grid
 * rather than fighting it.
 */
export function furrowPath(width: number, height: number, pitch: number): string {
    if (pitch <= 0 || width <= 0 || height <= 0) return '';
    const parts: string[] = [];
    for (let y = pitch; y < height; y += pitch) {
        parts.push(`M0 ${y.toFixed(1)}H${width.toFixed(1)}`);
    }
    return parts.join('');
}

export interface Speck {
    column: number;
    row: number;
    planted: boolean;
}

/**
 * Stones on bare earth and growth on planted ground, as two paths.
 *
 * Each speck is a dot rather than a shape, drawn as a zero-length line segment
 * with a round cap — which is how you get a thousand dots into one path
 * without a thousand nodes.
 *
 * The count per cell is deliberately low. The job is to break up a flat fill,
 * not to render soil; past about three the field turns to static and the crop
 * stops reading as crop.
 */
export function speckPaths(
    specks: Speck[],
    size: number,
): { earth: string; growth: string } {
    if (size <= 0) return { earth: '', growth: '' };

    const earth: string[] = [];
    const growth: string[] = [];

    for (const speck of specks) {
        const base = (speck.row * 8191 + speck.column) >>> 0;
        /*
         * Nought to two, so roughly a third of cells carry nothing. An even
         * scatter across every cell is a halftone screen, which is the one
         * texture that looks less like ground than a flat fill does.
         */
        const count = Math.floor(noise(base) * 3);
        for (let index = 0; index < count; index++) {
            const seed = (base * 31 + index * 7919) >>> 0;
            /*
             * Inset from the edges. A speck on a boundary reads as a nick in
             * the hedge rather than as something lying on the ground.
             */
            const x = (speck.column + 0.15 + noise(seed) * 0.7) * size;
            const y = (speck.row + 0.15 + noise(seed + 1) * 0.7) * size;
            (speck.planted ? growth : earth).push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
        }
    }

    return { earth: earth.join(''), growth: growth.join('') };
}

/**
 * A ragged edge for the land, as one filled path.
 *
 * The answer to a boundary that reads as ruled. Bushes along the edge were
 * tried first and only ever hid the line; this breaks it.
 *
 * The path is the whole surround with a WOBBLY HOLE cut in it, drawn over the
 * field with the ground colour, so the verge eats irregularly into the land.
 * Where it bites deep the grass comes in over the crop; where it barely bites
 * the field runs almost to its true edge. Nothing about the data changes: the
 * cells underneath are exactly where they were, and only the outermost few
 * points of the outermost chapters are covered.
 *
 * It takes the land's OUTLINE rather than a rectangle, because the land is
 * not one. The grid holds 1,189 chapters in rows of eleven, which leaves ten
 * empty cells in the last row — and cutting a rectangular hole around them
 * left that emptiness sitting inside the holding as a hard bar of bare
 * ground. The outline steps around it, so the map ends where the chapters do.
 *
 * The hole is wound BACKWARDS from the surround, and that is not decoration.
 * Even-odd fill would cut it either way, but this path is also used as a clip
 * region, and a renderer that quietly ignores `clipRule` falls back to
 * non-zero winding — under which two loops wound the same way are one solid
 * shape with no hole at all. The failure is spectacular rather than subtle:
 * the clip becomes the whole screen and grass floods the map. Opposite
 * winding makes the path mean the same thing under both rules, so nothing
 * depends on a renderer honouring an attribute.
 */
export function edgeFringe(
    width: number,
    height: number,
    /** The land's corners, clockwise. */
    outline: readonly (readonly [number, number])[],
    step: number,
    depth: number,
): string {
    if (width <= 0 || height <= 0 || step <= 0 || depth <= 0) return '';
    if (outline.length < 3) return '';

    const points: string[] = [];
    let index = 0;
    /* Always inward, never out: an outward excursion would land on ground that
     * is already this colour, so it draws nothing and only costs path. */
    const bite = () => depth * noise((index++ * 2654435761) >>> 0);

    for (let corner = 0; corner < outline.length; corner++) {
        const [fromX, fromY] = outline[corner];
        const [toX, toY] = outline[(corner + 1) % outline.length];
        const runX = toX - fromX;
        const runY = toY - fromY;
        const length = Math.hypot(runX, runY);
        if (length === 0) continue;

        /*
         * Inward normal of a clockwise edge in screen coordinates, where y
         * runs down: (-dy, dx). Getting the sign wrong here bites OUTWARD,
         * which draws nothing at all and looks exactly like the fringe not
         * working.
         */
        const normalX = -runY / length;
        const normalY = runX / length;

        const steps = Math.max(1, Math.round(length / step));
        for (let at = 0; at < steps; at++) {
            const along = at / steps;
            const depthHere = bite();
            const x = fromX + runX * along + normalX * depthHere;
            const y = fromY + runY * along + normalY * depthHere;
            points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
        }
    }

    /* Reversed: the surround runs clockwise, so the hole must run the other way. */
    const hole = `M${points.reverse().join('L')}Z`;
    const surround = `M0 0H${width.toFixed(1)}V${height.toFixed(1)}H0Z`;
    return surround + hole;
}

/**
 * The empty tail of the grid's last row.
 *
 * 1,189 chapters in rows of eleven leaves ten cells over, so the bottom of
 * the holding is not a straight line — and everything that grows around the
 * land has to know that, or it leaves the emptiness bare.
 */
export interface Tail {
    /** Ground at or past this x, on the last row, is not land. */
    fromX: number;
    /** ...and at or past this y. */
    fromY: number;
}

/** Whether a lattice point falls in the sown verge rather than behind the land. */
function inVerge(
    x: number,
    y: number,
    width: number,
    height: number,
    band: number,
    bandY: number,
    tail?: Tail,
): boolean {
    if (tail && x >= tail.fromX && y >= tail.fromY) return true;
    return !(x > band && x < width - band && y > bandY && y < height - bandY);
}

/**
 * Low grass for the verge past the hedge.
 *
 * Deliberately plainer and darker than the sward on cleared ground — the
 * same kind of thing, left alone.
 */
export function vergePaths(
    width: number,
    height: number,
    pitch: number,
    band: number,
    bandY: number = band,
    tail?: Tail,
): { back: string; tip: string } {
    const back: string[] = [];
    const tip: string[] = [];
    if (pitch <= 0 || width <= 0 || height <= 0 || band <= 0) return { back: '', tip: '' };

    for (let row = 0; row * pitch < height; row++) {
        for (let column = 0; column * pitch < width; column++) {
            const pointX = column * pitch;
            const pointY = row * pitch;
            if (!inVerge(pointX, pointY, width, height, band, bandY, tail)) continue;

            const seed = (row * 7919 + column * 104729) >>> 0;
            const baseX = pointX + noise(seed) * pitch;
            const baseY = pointY + noise(seed + 1) * pitch;
            const blades = 1 + Math.floor(noise(seed + 2) * 2);

            for (let blade = 0; blade < blades; blade++) {
                const bladeSeed = (seed + blade * 2654435761) >>> 0;
                const lean = (noise(bladeSeed) - 0.5) * pitch * 0.7;
                const tall = pitch * (0.45 + noise(bladeSeed + 1) * 0.45);
                const segment =
                    `M${baseX.toFixed(1)} ${baseY.toFixed(1)}` +
                    `Q${(baseX + lean * 0.3).toFixed(1)} ${(baseY - tall * 0.65).toFixed(1)} ` +
                    `${(baseX + lean).toFixed(1)} ${(baseY - tall).toFixed(1)}`;
                (noise(bladeSeed + 2) > 0.55 ? tip : back).push(segment);
            }
        }
    }

    return { back: back.join(''), tip: tip.join('') };
}

/**
 * Soft patches of lighter and darker ground under the verge.
 *
 * Drawn as very fat, very faint round dots. Without them the surround is one
 * flat green behind the grass, and the eye reads the flatness before it reads
 * anything growing — the same reason every cell of the field is weathered.
 */
export function patchPath(
    width: number,
    height: number,
    pitch: number,
    band: number,
    bandY: number = band,
    tail?: Tail,
): string {
    if (pitch <= 0 || width <= 0 || height <= 0 || band <= 0) return '';
    const parts: string[] = [];
    for (let row = 0; row * pitch < height; row++) {
        for (let column = 0; column * pitch < width; column++) {
            const pointX = column * pitch;
            const pointY = row * pitch;
            if (!inVerge(pointX, pointY, width, height, band, bandY, tail)) continue;
            const seed = (row * 31337 + column * 6151) >>> 0;
            if (noise(seed) < 0.55) continue;
            const x = pointX + noise(seed + 1) * pitch;
            const y = pointY + noise(seed + 2) * pitch;
            parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
        }
    }
    return parts.join('');
}

/** A planted chapter, and how recently it was planted. */
export interface Sprout {
    column: number;
    row: number;
    /** 1 freshest, 5 longest ago. */
    tier: number;
}

/**
 * Sward — grass on cleared, planted ground.
 *
 * The opposite of the verge beyond the hedge in every parameter that
 * matters, and deliberately so. That grass is loose, leggy and uneven; this
 * is short, close-set, near enough upright, and regular. Evenness is what the
 * eye reads as tended, and it is the whole reason a field looks like a field
 * rather than like a clearing.
 *
 * Two things follow the data rather than the look. Blades sit on a regular
 * sub-lattice inside the cell, because a sown crop is planted in rows. And
 * vigour follows recency: freshly worked ground stands full, ground last
 * touched years ago is short and thin. The colour already fades with age, and
 * if the growth did not fade with it an old field would read as a mown one
 * rather than as one left alone.
 *
 * `budget` is blades per cell. A reader who has written about the whole Bible
 * has 1,189 planted cells, so the caller thins the sowing as the holding
 * fills — nobody can count blades, and everybody can feel a slow screen.
 */
export function swardPaths(
    sprouts: Sprout[],
    size: number,
    budget: number,
): { back: string; tip: string } {
    const back: string[] = [];
    const tip: string[] = [];
    if (size <= 0 || budget <= 0) return { back: '', tip: '' };

    for (const sprout of sprouts) {
        const vigour = Math.max(0.35, 1 - (sprout.tier - 1) * 0.16);
        const blades = sprout.tier <= 2 ? budget : Math.max(1, budget - 1);
        const origin = (sprout.row * 8191 + sprout.column) >>> 0;

        for (let blade = 0; blade < blades; blade++) {
            const seed = (origin * 2246822519 + blade * 3266489917) >>> 0;
            const slot = (blade + 0.5) / blades;
            const x = (sprout.column + 0.12 + slot * 0.76 + (noise(seed) - 0.5) * 0.1) * size;
            const y = (sprout.row + 0.84 - noise(seed + 1) * 0.3) * size;

            const tall = size * (0.26 + noise(seed + 2) * 0.2) * vigour;
            /* A sway, not a lean. The verge grass leans three times as far. */
            const lean = (noise(seed + 3) - 0.5) * size * 0.22;

            const segment =
                `M${x.toFixed(1)} ${y.toFixed(1)}` +
                `Q${(x + lean * 0.3).toFixed(1)} ${(y - tall * 0.65).toFixed(1)} ` +
                `${(x + lean).toFixed(1)} ${(y - tall).toFixed(1)}`;

            (noise(seed + 4) > 0.5 ? tip : back).push(segment);
        }
    }

    return { back: back.join(''), tip: tip.join('') };
}
