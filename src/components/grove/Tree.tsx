/**
 * A practice's tree, drawn in a 100×120 box whose ground line is y = 112.
 * Stages below FIRST_TREE_STAGE are shared seedlings; from there each species
 * takes its own shape. design/practices-grove.html.
 */
import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { FIRST_TREE_STAGE, SPECIES, SpeciesKey } from '../../grove/grove';

const SOIL = '#8a6a45';
const SEED = '#6e5234';
const TRUNK = '#4a3b27';
const GREEN = '#5f9e4a';
const GREEN_DARK = '#4d8a3a';
const GREEN_LIGHT = '#9fd071';
/** Around a seedling's leaves, so they keep their shape small and on green ground. */
const OUTLINE = '#2f4a24';

/**
 * The part of the 100×120 box each stage actually occupies, soil included.
 * Seedlings fill only the foot of the box, so drawn in the whole of it they
 * are a speck; `fit` crops to this instead. Trees use the whole box.
 */
export const STAGE_BOX: { x: number; y: number; w: number; h: number }[] = [
    { x: 30, y: 100, w: 40, h: 20 },
    { x: 28, y: 92, w: 44, h: 28 },
    { x: 26, y: 82, w: 48, h: 38 },
    { x: 24, y: 70, w: 52, h: 50 },
    { x: 22, y: 56, w: 56, h: 64 },
];
const FULL_BOX = { x: 0, y: 0, w: 100, h: 120 };

export const boxOf = (stage: number, fit: boolean) =>
    fit && stage < FIRST_TREE_STAGE ? STAGE_BOX[stage] : FULL_BOX;

/** Foliage fades toward dry grass when a tree is thirsty; trunk, soil and fruit do not. */
function fade(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number, d: number) => Math.round(c + (d - c) * 0.45);
    const r = mix((n >> 16) & 255, 0xc2);
    const g = mix((n >> 8) & 255, 0xbf);
    const b = mix(n & 255, 0x98);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

type Leaf = (hex: string) => string;

function seedling(s: number, leaf: Leaf): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    if (s === 0) {
        out.push(<Ellipse key="seed" cx={50} cy={109} rx={5} ry={3.5} fill={SEED} />);
        return out;
    }
    if (s <= 3) {
        const h = [0, 10, 20, 32][s];
        out.push(
            <Path
                key="stem"
                d={`M50 112 C50 ${112 - h * 0.5} 49 ${112 - h * 0.8} 51 ${112 - h}`}
                stroke={leaf(GREEN_DARK)} strokeWidth={1.8 + s * 0.5} fill="none"
            />,
        );
        const pairs = [[0], [1], [0.55, 1], [0.35, 0.7, 1]][s];
        pairs.forEach((f, k) => {
            const y = 112 - h * f;
            out.push(
                <Ellipse key={`l${k}`} cx={43} cy={y} rx={6 + s} ry={3.2 + s * 0.5} fill={leaf(GREEN)} stroke={OUTLINE} strokeWidth={0.9} rotation={-28} origin={`43, ${y}`} />,
                <Ellipse key={`r${k}`} cx={57} cy={y - 2} rx={6 + s} ry={3.2 + s * 0.5} fill={leaf(k % 2 ? GREEN_LIGHT : GREEN_DARK)} stroke={OUTLINE} strokeWidth={0.9} rotation={24} origin={`57, ${y - 2}`} />,
            );
        });
        return out;
    }
    // Sapling: a thin trunk and the first clusters, still smaller than any young tree.
    out.push(<Path key="trunk" d="M50 112 L50 78" stroke={TRUNK} strokeWidth={3} />);
    ([[43, 79, 7.5, GREEN_DARK], [57, 79, 7.5, GREEN_DARK], [50, 70, 9.5, GREEN], [50, 86, 5, GREEN_LIGHT]] as const)
        .forEach(([x, y, r, c], i) => out.push(<Circle key={`c${i}`} cx={x} cy={y} r={r} fill={leaf(c)} />));
    return out;
}

/** A young tree starts taller than the sapling before it; growth never looks like shrinking. */
const scale = (k: number) => [0.72, 0.8, 0.88, 0.95, 1][k];

/** Species from the young-tree stage on. `k` runs 0 (young tree) … 4 (bearing fruit). */
const SHAPES: Record<SpeciesKey, (k: number, leaf: Leaf) => React.ReactNode[]> = {
    olive: (k, leaf) => {
        const s = scale(k); const top = 112 - 80 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 C44 ${112 - 20 * s} 58 ${112 - 34 * s} 49 ${112 - 50 * s} C45 ${112 - 58 * s} 52 ${top + 18} 50 ${top + 14}`} stroke="#6b5a47" strokeWidth={5 + 4 * s} fill="none" strokeLinecap="round" />);
        out.push(<Path key="b" d={`M49 ${112 - 46 * s} C40 ${112 - 52 * s} 36 ${top + 20} 32 ${top + 14}`} stroke="#6b5a47" strokeWidth={2.5 + 2 * s} fill="none" strokeLinecap="round" />);
        [[-20, 6, 18, 10], [18, 4, 18, 10], [0, -4, 22, 12], [-10, -12, 14, 8], [12, -12, 14, 8], [0, 10, 16, 8]]
            .forEach(([dx, dy, rx, ry], i) => out.push(<Ellipse key={`f${i}`} cx={50 + dx * s * 1.2} cy={top + dy * s + 10} rx={rx * s} ry={ry * s} fill={leaf('#8a9a6b')} />));
        [[-16, -2], [14, -6], [2, -12], [-4, 6], [20, 8]]
            .forEach(([dx, dy], i) => out.push(<Ellipse key={`h${i}`} cx={50 + dx * s * 1.2} cy={top + dy * s + 10} rx={6 * s} ry={3 * s} fill={leaf('#aab68b')} />));
        if (k === 4) [[-18, 8], [8, -2], [20, 6], [-4, 12], [-10, -8], [14, 14]]
            .forEach(([dx, dy], i) => out.push(<Circle key={`o${i}`} cx={50 + dx} cy={top + dy + 10} r={2.6} fill="#3d3f2a" />));
        return out;
    },
    fig: (k, leaf) => {
        const s = scale(k); const top = 112 - 70 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 L50 ${top + 30}`} stroke="#5f4a36" strokeWidth={6 + 3 * s} />);
        [-22, 0, 22].forEach((dx, i) => out.push(<Path key={`b${i}`} d={`M50 ${top + 34} Q${50 + dx * 0.4} ${top + 22} ${50 + dx * s} ${top + 14}`} stroke="#5f4a36" strokeWidth={3 + s} fill="none" strokeLinecap="round" />));
        [[-30, 14], [30, 14], [-18, 2], [18, 2], [0, -2], [-8, 14], [10, 16], [0, 8]].forEach(([dx, dy], i) => {
            const x = 50 + dx * s; const y = top + dy * s + 6;
            out.push(<Circle key={`f${i}`} cx={x} cy={y} r={11 * s} fill={leaf(GREEN)} />, <Circle key={`h${i}`} cx={x - 4 * s} cy={y - 3 * s} r={5 * s} fill={leaf('#77b35c')} />);
        });
        if (k === 4) [[-24, 18], [22, 20], [-6, 22], [12, 6], [-16, 6]]
            .forEach(([dx, dy], i) => out.push(<Ellipse key={`o${i}`} cx={50 + dx} cy={top + dy + 6} rx={3.2} ry={3.8} fill="#9c7a3c" />));
        return out;
    },
    cedar: (k, leaf) => {
        const s = scale(k); const top = 112 - 92 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 L50 ${top + 6}`} stroke={TRUNK} strokeWidth={4 + 4 * s} />);
        const tiers = k < 3 ? 3 + k : 5;
        for (let i = 0; i < tiers; i++) {
            const y = 112 - (26 + i * (62 / tiers)) * s; const w = (40 - i * 6) * s;
            out.push(<Ellipse key={`a${i}`} cx={50} cy={y} rx={w} ry={5 * s} fill={leaf('#3f6b3a')} />, <Ellipse key={`b${i}`} cx={50 - w * 0.25} cy={y - 2 * s} rx={w * 0.55} ry={3 * s} fill={leaf('#557f47')} />);
        }
        if (k === 4) [[-20, -40], [16, -48], [-8, -62], [10, -30]]
            .forEach(([dx, dy], i) => out.push(<Ellipse key={`c${i}`} cx={50 + dx} cy={112 + dy} rx={2} ry={3.2} fill="#7a5f3c" />));
        return out;
    },
    palm: (k, leaf) => {
        const s = scale(k); const top = 112 - 92 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 Q56 ${112 - 50 * s} 52 ${top + 8}`} stroke="#7a6243" strokeWidth={5 + 2 * s} fill="none" strokeLinecap="round" />);
        const rings = Math.floor(6 * s) + 2;
        for (let i = 0; i < rings; i++) {
            const y = 112 - i * ((92 * s) / (6 * s + 2));
            out.push(<Path key={`r${i}`} d={`M${46 + i * 0.3} ${y} l8 0`} stroke="#5e4a33" strokeWidth={1.2} opacity={0.8} />);
        }
        [-160, -125, -90, -55, -20, -140, -40].forEach((a, i) => {
            const r = 28 * s; const x2 = 52 + r * Math.cos((a * Math.PI) / 180); const y2 = top + 8 + r * Math.sin((a * Math.PI) / 180) + 12 * s;
            out.push(<Path key={`f${i}`} d={`M52 ${top + 8} Q${(52 + x2) / 2} ${top - 10 * s} ${x2} ${y2}`} stroke={leaf('#6f9a4a')} strokeWidth={3.5 * s + 1} fill="none" strokeLinecap="round" />);
        });
        if (k === 4) [-5, 5].forEach(dx => [0, 1, 2, 3].forEach(j =>
            out.push(<Circle key={`d${dx}${j}`} cx={52 + dx + (j % 2) * 2} cy={top + 14 + j * 3} r={2.4} fill="#d08a2c" />)));
        return out;
    },
    pomegranate: (k, leaf) => {
        const s = scale(k); const top = 112 - 62 * s; const out: React.ReactNode[] = [];
        [-6, 0, 6].forEach((dx, i) => out.push(<Path key={`t${i}`} d={`M50 112 Q${50 + dx * 0.5} ${112 - 20 * s} ${50 + dx * 1.6} ${top + 22}`} stroke="#5a4432" strokeWidth={2.5 + 1.5 * s} fill="none" strokeLinecap="round" />));
        [[0, 6, 20], [-16, 12, 13], [16, 12, 13], [-8, -4, 12], [10, -4, 12]].forEach(([dx, dy, r], i) => {
            out.push(<Circle key={`f${i}`} cx={50 + dx * s} cy={top + dy * s + 8} r={r * s} fill={leaf(GREEN_DARK)} />, <Circle key={`h${i}`} cx={50 + dx * s - 3 * s} cy={top + dy * s + 5 * s} r={r * s * 0.4} fill={leaf('#66a24f')} />);
        });
        if (k >= 3) (k === 4 ? [[-14, 14], [12, 6], [2, -6], [18, 18], [-4, 20]] : [[-10, 4], [12, 10]])
            .forEach(([dx, dy], i) => out.push(<Circle key={`p${i}`} cx={50 + dx} cy={top + dy + 8} r={k === 4 ? 3.6 : 2.2} fill="#b5483a" />));
        return out;
    },
    almond: (k, leaf) => {
        const s = scale(k); const top = 112 - 78 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 L50 ${top + 26}`} stroke="#5a4432" strokeWidth={3 + 2.5 * s} />);
        [[-20, 14], [20, 12], [-8, 24], [10, 26]].forEach(([dx, up], i) => out.push(<Path key={`b${i}`} d={`M50 ${top + 30} L${50 + dx * s} ${top + 30 - up * s}`} stroke="#5a4432" strokeWidth={1.6 + s} />));
        [[-20, 10, 10], [20, 12, 10], [-8, -2, 11], [10, -2, 11], [0, 12, 10], [0, -10, 8]]
            .forEach(([dx, dy, r], i) => out.push(<Circle key={`f${i}`} cx={50 + dx * s} cy={top + dy * s + 8} r={r * s} fill={leaf('#7fa65a')} opacity={0.9} />));
        if (k >= 3) {
            const blossoms = [[-22, 8], [-14, 0], [-6, -10], [6, -12], [16, -2], [22, 10], [-2, 4], [10, 14], [-12, 16], [4, -2], [18, 4], [-18, 14]];
            (k === 4 ? blossoms : blossoms.slice(0, 6)).forEach(([dx, dy], i) => out.push(
                <Circle key={`p${i}`} cx={50 + dx * s} cy={top + dy * s + 8} r={3} fill="#f1d6d0" />,
                <Circle key={`q${i}`} cx={50 + dx * s + 0.8} cy={top + dy * s + 7.2} r={1.2} fill="#fbf3ee" />,
            ));
        }
        return out;
    },
    acacia: (k, leaf) => {
        const s = scale(k); const top = 112 - 66 * s; const out: React.ReactNode[] = [];
        out.push(<Path key="t" d={`M50 112 L50 ${top + 34}`} stroke={TRUNK} strokeWidth={3.5 + 2.5 * s} />);
        out.push(<Path key="l" d={`M50 ${top + 36} L${36 - 4 * s} ${top + 10}`} stroke={TRUNK} strokeWidth={2 + 1.5 * s} />);
        out.push(<Path key="r" d={`M50 ${top + 36} L${64 + 4 * s} ${top + 10}`} stroke={TRUNK} strokeWidth={2 + 1.5 * s} />);
        out.push(<Ellipse key="a" cx={50} cy={top + 6} rx={38 * s} ry={9 * s} fill={leaf('#7c9a4d')} />);
        out.push(<Ellipse key="b" cx={44} cy={top + 2} rx={26 * s} ry={5 * s} fill={leaf('#93b062')} />);
        out.push(<Ellipse key="c" cx={58} cy={top + 9} rx={22 * s} ry={4 * s} fill={leaf('#65853f')} />);
        if (k === 4) [-28, -16, -4, 8, 20, 30].forEach((dx, i) => out.push(<Circle key={`y${i}`} cx={50 + dx * s} cy={top + 1} r={2.4} fill="#d9b84a" />));
        return out;
    },
    mustard: (k, leaf) => {
        const s = scale(k); const top = 112 - 68 * s; const out: React.ReactNode[] = [];
        [-10, -4, 3, 9].forEach((dx, i) => out.push(<Path key={`t${i}`} d={`M50 112 Q${50 + dx * 0.4} ${112 - 26 * s} ${50 + dx * 1.8 * s} ${top + 18}`} stroke="#5a4432" strokeWidth={1.8 + s} fill="none" strokeLinecap="round" />));
        [[0, 8, 18], [-18, 14, 12], [18, 14, 12], [-10, -6, 12], [12, -6, 12], [0, -12, 10]].forEach(([dx, dy, r], i) => {
            out.push(<Circle key={`f${i}`} cx={50 + dx * s} cy={top + dy * s + 6} r={r * s} fill={leaf('#7fb04f')} />, <Circle key={`h${i}`} cx={50 + dx * s - 3 * s} cy={top + dy * s + 3 * s} r={r * s * 0.35} fill={leaf('#9fcc6b')} />);
        });
        // Matthew 13:32 — birds in its branches once it is full grown.
        if (k === 4) [[36, top + 2], [62, top + 8], [50, top - 6]].forEach(([x, y], i) => out.push(
            <Ellipse key={`w${i}`} cx={x} cy={y} rx={3.4} ry={2.2} fill="#2f3a4a" />,
            <Path key={`k${i}`} d={`M${x + 2} ${y - 1} l3 -1.5`} stroke="#2f3a4a" strokeWidth={1.4} strokeLinecap="round" />,
        ));
        return out;
    },
};

export interface TreeProps {
    stage: number;
    species: number;
    thirsty?: boolean;
    size?: number;
    /** Draw the soil mound under it. */
    ground?: boolean;
    /** Crop a seedling to what it occupies, so it is drawn at `size` rather than lost in a tree's box. */
    fit?: boolean;
}

export const Tree = React.memo(({ stage, species, thirsty = false, size = 80, ground = true, fit = false }: TreeProps) => {
    const leaf: Leaf = thirsty ? fade : (hex => hex);
    const key = SPECIES[species % SPECIES.length].key;
    const body = stage < FIRST_TREE_STAGE ? seedling(stage, leaf) : SHAPES[key](stage - FIRST_TREE_STAGE, leaf);

    const box = boxOf(stage, fit);

    return (
        <Svg width={size} height={(size * box.h) / box.w} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
            {ground && <Ellipse cx={50} cy={113} rx={18 + stage * 2.4} ry={5} fill={SOIL} />}
            {/* A thirsty tree leans a little, as if it had given up holding itself straight. */}
            <G rotation={thirsty ? 6 : 0} origin="50, 112">{body}</G>
        </Svg>
    );
});

Tree.displayName = 'Tree';
