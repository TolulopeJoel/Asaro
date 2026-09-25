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
 * The better answer to a boundary that reads as ruled. Everything else tried
 * so far hid the join — bigger bushes, deeper overhang — and hiding a straight
 * line with objects placed on it only draws attention to how straight it is.
 * This breaks the line itself.
 *
 * The path is the whole surround with a WOBBLY HOLE cut in it, drawn over the
 * field with the ground colour, so the verge eats irregularly into the land.
 * Where it bites deep the grass comes in over the crop; where it barely bites
 * the field runs almost to its true edge. Nothing about the data changes: the
 * cells underneath are exactly where they were, and only the outermost few
 * points of the outermost chapters are covered.
 *
 * Even-odd fill does the cutting, which is why the hole does not need to be
 * wound backwards — a detail worth stating because getting it wrong fills the
 * entire screen with grass and looks, briefly, like the map has vanished.
 */
export function edgeFringe(
    width: number,
    height: number,
    insetX: number,
    insetY: number,
    step: number,
    depth: number,
): string {
    if (width <= 0 || height <= 0 || step <= 0 || depth <= 0) return '';
    const left = insetX;
    const right = width - insetX;
    const top = insetY;
    const bottom = height - insetY;
    if (right <= left || bottom <= top) return '';

    const points: string[] = [];
    let index = 0;
    /* Always inward, never out: an outward excursion would land on ground that
     * is already this colour and show as nothing, so it is only wasted path. */
    const bite = () => depth * noise((index++ * 2654435761) >>> 0);

    for (let x = left; x < right; x += step) points.push(`${x.toFixed(1)} ${(top + bite()).toFixed(1)}`);
    for (let y = top; y < bottom; y += step) points.push(`${(right - bite()).toFixed(1)} ${y.toFixed(1)}`);
    for (let x = right; x > left; x -= step) points.push(`${x.toFixed(1)} ${(bottom - bite()).toFixed(1)}`);
    for (let y = bottom; y > top; y -= step) points.push(`${(left + bite()).toFixed(1)} ${y.toFixed(1)}`);

    const hole = `M${points.join('L')}Z`;
    const surround = `M0 0H${width.toFixed(1)}V${height.toFixed(1)}H0Z`;
    return surround + hole;
}

/** Whether a lattice point falls in the sown verge rather than behind the land. */
function inVerge(
    x: number,
    y: number,
    width: number,
    height: number,
    band: number,
    bandY: number,
): boolean {
    return !(x > band && x < width - band && y > bandY && y < height - bandY);
}

/**
 * A filled ellipse, as a path — cheaper than a node per lobe.
 *
 * Separate radii because these were circles once, and circles were wrong.
 * A round lobe makes a ball, and a ball sitting on the dead-straight line of
 * a field boundary is the most conspicuous shape you can put there: it reads
 * as something perched on the edge rather than as growth along it. Squashing
 * the vertical radius gives a low, spreading mound, which is both what a bush
 * looks like from above and what stops it standing proud of the hedge.
 */
function blob(x: number, y: number, rx: number, ry: number): string {
    const a = `a${rx.toFixed(1)},${ry.toFixed(1)} 0 1,0`;
    return `M${(x - rx).toFixed(1)} ${y.toFixed(1)}${a} ${(rx * 2).toFixed(1)},0${a} ${(-rx * 2).toFixed(1)},0`;
}

/**
 * How squashed a lobe is: its height as a fraction of its width.
 *
 * The single number deciding whether the border reads as bushes growing along
 * an edge or as balls lined up on one. Nearer 1 and they bulge; much lower
 * and they smear into a hedge.
 */
const LOBE_FLATTEN = 0.58;

/**
 * Low grass for the verge past the hedge.
 *
 * What grows between the bushes. Deliberately plainer and darker than the
 * sward on cleared ground — it is the same kind of thing, not tended.
 */
export function vergePaths(
    width: number,
    height: number,
    pitch: number,
    band: number,
    bandY: number = band,
): { back: string; tip: string } {
    const back: string[] = [];
    const tip: string[] = [];
    if (pitch <= 0 || width <= 0 || height <= 0 || band <= 0) return { back: '', tip: '' };

    for (let row = 0; row * pitch < height; row++) {
        for (let column = 0; column * pitch < width; column++) {
            const pointX = column * pitch;
            const pointY = row * pitch;
            if (!inVerge(pointX, pointY, width, height, band, bandY)) continue;

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
 * Bushes: discrete clumps growing along the edge of the land.
 *
 * A bush is a thing you can count, not a texture. It is rounded, it sits
 * clear of its neighbours, and it stands a good bit higher than the grass
 * around it — which is the whole reason it reads as a bush and not as long
 * grass. Built accordingly:
 *
 *   **A mound of lobes.** Four overlapping circles, wider than tall, sitting
 *   on the ground line. Overlapping circles are what give a shrub its lumpy
 *   silhouette; one circle is a ball and two is a cloud.
 *
 *   **A lit crown.** Two smaller circles high on one side. Light comes from
 *   the same side for every bush on the map, because light that changes
 *   direction between one bush and the next is the fastest way to make a
 *   scene look assembled rather than seen.
 *
 *   **Twigs.** A few strokes off the top, so the outline is broken and the
 *   mound does not read as a blob.
 *
 * They are placed by walking the field's PERIMETER rather than by sowing a
 * lattice across the verge, and that is the important part. Sowing a widened
 * band put bushes at every point in it — including points well inside the
 * land, where a shrub sitting on its own in the middle of somebody's crop
 * looks like a mistake rather than like an edge. Walking the boundary means
 * every bush is on it: rooted just outside, leaning in, covering the hedge
 * the way vegetation actually does.
 */
export interface Bushes {
    mass: string;
    crown: string;
    twigs: string;
}

/**
 * One shrub, growing on a boundary at `x`,`y`.
 *
 * The mound is described in the edge's own frame — ALONG it and NORMAL to it
 * — and only mapped to the screen at the end. That indirection is the whole
 * substance of this function.
 *
 * Flattening a mound vertically makes it low and wide, which is right for the
 * top and bottom edges and actively wrong for the sides: on a vertical
 * boundary a wide mound protrudes by its full width, so the very squashing
 * that settled the ends made the flanks bulge worse than before. A bush
 * spreads ALONG the edge it grows on and stays shallow across it, whichever
 * edge that is.
 *
 * `alongX` says the boundary runs horizontally; `outward` is +1 or -1 along
 * the normal, pointing away from the field.
 */
function shrub(
    x: number,
    y: number,
    radius: number,
    seed: number,
    alongX: boolean,
    outward: number,
    mass: string[],
    crown: string[],
    twigs: string[],
): void {
    const deep = radius * LOBE_FLATTEN;

    /** A lobe at `along`/`normal` lengths from the root, in mound units. */
    const lobe = (along: number, normal: number, scale: number) => {
        const a = along * radius;
        const n = normal * deep * outward;
        return alongX
            ? blob(x + a, y + n, radius * scale, deep * scale)
            : blob(x + n, y + a, deep * scale, radius * scale);
    };

    mass.push(lobe(0, 0.35, 0.82));
    mass.push(lobe(-0.7, 0.05, 0.62));
    mass.push(lobe(0.7, 0.05, 0.62));
    mass.push(lobe(0, 0.9, 0.58));

    /*
     * The lit side, placed in SCREEN space — up and to the left of the mound,
     * on every bush on the map whichever edge it sits on. Light that changes
     * direction between one bush and the next is the fastest way to make a
     * scene look assembled rather than seen.
     */
    const centreX = x + (alongX ? 0 : deep * 0.45 * outward);
    const centreY = y + (alongX ? deep * 0.45 * outward : 0);
    const crownX = alongX ? radius * 0.3 : deep * 0.3;
    const crownY = alongX ? deep * 0.3 : radius * 0.3;
    crown.push(blob(centreX - radius * 0.2, centreY - crownY * 0.9, crownX, crownY));
    crown.push(blob(centreX + radius * 0.14, centreY - crownY * 0.2, crownX * 0.7, crownY * 0.7));

    /*
     * Twigs go outward, away from the field. They break the mound's outline
     * where there is grass to break it against, and keep clutter off the
     * chapters the canopy is already overhanging.
     */
    const sprigs = 2 + Math.floor(noise(seed + 4) * 2);
    for (let sprig = 0; sprig < sprigs; sprig++) {
        const sprigSeed = (seed + sprig * 2654435761) >>> 0;
        const fan = (sprig - (sprigs - 1) / 2) / Math.max(1, sprigs - 1);
        const alongFrom = fan * radius * 1.0;
        const normalFrom = deep * (0.85 + noise(sprigSeed) * 0.3) * outward;
        const alongTo = alongFrom + (noise(sprigSeed + 1) - 0.5) * radius * 0.5;
        const normalTo = normalFrom + deep * (0.4 + noise(sprigSeed + 2) * 0.45) * outward;

        const from = alongX ? [x + alongFrom, y + normalFrom] : [x + normalFrom, y + alongFrom];
        const to = alongX ? [x + alongTo, y + normalTo] : [x + normalTo, y + alongTo];
        const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

        twigs.push(
            `M${from[0].toFixed(1)} ${from[1].toFixed(1)}` +
            `Q${mid[0].toFixed(1)} ${mid[1].toFixed(1)} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`,
        );
    }
}

/**
 * `insetX`/`insetY` locate the field's boundary inside the surround — the
 * line the bushes grow along. `pitch` is how far apart they are placed along
 * it, before roughly two in five are skipped so the line does not read as a
 * planted hedge.
 *
 * `sideShare` thins the two long flanks specifically, and it exists because
 * of a real imbalance. The holding is about nine times taller than it is
 * wide, so an even placement puts nine bushes down the sides for every one at
 * an end — a hundred and thirty-odd near-identical mounds running the whole
 * length of the map, which stops reading as scenery and starts reading as a
 * printed border. The ends are where a holding visibly begins and finishes
 * and where the verge is deep enough to hold a bush properly; the flanks are
 * a narrow strip that mostly wants to be quiet. Set it to 0 for none at all.
 */
export function bushPaths(
    width: number,
    height: number,
    insetX: number,
    insetY: number,
    pitch: number,
    sideShare: number = 1,
): Bushes {
    const mass: string[] = [];
    const crown: string[] = [];
    const twigs: string[] = [];
    if (pitch <= 0 || width <= 0 || height <= 0) return { mass: '', crown: '', twigs: '' };

    const left = insetX;
    const right = width - insetX;
    const top = insetY;
    const bottom = height - insetY;
    if (right <= left || bottom <= top) return { mass: '', crown: '', twigs: '' };

    /*
     * Each bush is pushed a little way OUT of the field along the edge's own
     * normal, so its root is in the verge and only its canopy reaches over the
     * boundary. Pushing it in instead would plant it in the crop.
     */
    const place = (x: number, y: number, alongX: boolean, outward: number, index: number) => {
        const seed = (index * 2654435761) >>> 0;
        /*
         * A quarter skipped at an end, far more than that down a flank. The
         * ends carry the density because that is where the verge is deep
         * enough to hold a bush and where the holding visibly starts and
         * stops — and because there are only a dozen positions along each of
         * them, against a hundred down each side.
         */
        const keep = alongX ? 0.75 : 0.75 * Math.max(0, Math.min(1, sideShare));
        if (noise(seed) > keep) return;
        /*
         * Wider than when the lobes were circular, to keep the mound standing
         * clear of the grass now that it is squashed — a bush has to read as
         * taller than what grows around it or it is not a bush.
         */
        const radius = pitch * (0.38 + noise(seed + 3) * 0.22);
        /*
         * Sat further out than it used to be. The ragged edge is what blends
         * the land into the verge now, so a bush only has to lean on the
         * boundary rather than reach across it — and less canopy over the
         * crop means fewer chapters hidden.
         */
        const out = radius * LOBE_FLATTEN * (0.18 + noise(seed + 5) * 0.34);
        shrub(
            x + (alongX ? 0 : out * outward),
            y + (alongX ? out * outward : 0),
            radius,
            seed,
            alongX,
            outward,
            mass,
            crown,
            twigs,
        );
    };

    let index = 0;
    /* Along the two long edges, then the two short ones. Corners are left to
     * one walk each so a bush is never stacked on another. */
    for (let y = top; y < bottom; y += pitch) {
        place(left, y + noise(index * 7919) * pitch * 0.5, false, -1, index++);
        place(right, y + noise(index * 7919) * pitch * 0.5, false, 1, index++);
    }
    for (let x = left + pitch; x < right - pitch; x += pitch) {
        place(x + noise(index * 7919) * pitch * 0.5, top, true, -1, index++);
        place(x + noise(index * 7919) * pitch * 0.5, bottom, true, 1, index++);
    }

    return { mass: mass.join(''), crown: crown.join(''), twigs: twigs.join('') };
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
): string {
    if (pitch <= 0 || width <= 0 || height <= 0 || band <= 0) return '';
    const parts: string[] = [];
    for (let row = 0; row * pitch < height; row++) {
        for (let column = 0; column * pitch < width; column++) {
            const pointX = column * pitch;
            const pointY = row * pitch;
            if (!inVerge(pointX, pointY, width, height, band, bandY)) continue;
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
 * The opposite of the bush in every parameter that matters, and deliberately
 * so. Bush is tall, tangled and massed; this is short, close-set, near enough
 * upright, and even. Evenness is what the eye reads as tended, and it is the
 * whole reason a field looks like a field rather than like a clearing.
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
            /* A sway, not a lean. Compare the bush, which goes to 1.9. */
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
