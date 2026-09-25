/**
 * Where every chapter sits on the land, and where one book's ground ends.
 *
 * The rule, and everything else follows from it: **one chapter is one cell of
 * a single uniform grid.** Not a share of a plot that has been stretched to
 * fit — an actual, identical square, the same size in Obadiah as in Psalms.
 * A reader finishing a chapter tonight should see one of these fill in, and
 * that only works if they are all the same thing.
 *
 * Which means a book gets no say in its own shape. Its chapters take the next
 * cells in the grid, wrapping at the edge of the field like text wrapping in a
 * paragraph, and where its run happens to start and stop decides what it looks
 * like. Fifty chapters across eleven columns is four full rows and a tail of
 * six, so Genesis is an L. Some books are staircases. A book that starts near
 * the right edge is a few cells, then a block.
 *
 * That irregularity is the point. Earlier versions balanced each book into a
 * tidy rectangle by spreading the remainder across its rows, which is the
 * "boxing each book into a rectangle" problem in its subtlest form: to keep
 * the corner square it had to make the beds of one book a different size from
 * the beds of the next. Real parcels are not rectangles. They are whatever
 * shape the ground and the boundary left them, and an L-shaped field is a
 * completely ordinary thing to own.
 *
 * So what demarcates a book is no longer a box drawn around it but an OUTLINE
 * traced along it: a cell carries a hedge on each side where its neighbour
 * belongs to another book, or where there is no neighbour at all. Those edges
 * are computed here rather than drawn by eye, which is what lets the boundary
 * follow a staircase exactly.
 *
 * Pure, and in cells rather than points, so the whole layout can be checked at
 * a boundary without a renderer.
 */

/** One chapter's square, and which of its sides carry a boundary. */
export interface Cell {
    /** Index into the books array this layout was given. */
    book: number;
    /** 1-based chapter within that book. */
    chapter: number;
    column: number;
    row: number;
    /** A side is an edge where the neighbour is another book, or nothing. */
    edgeTop: boolean;
    edgeRight: boolean;
    edgeBottom: boolean;
    edgeLeft: boolean;
}

/** Where a book's name can go: its widest unbroken run of cells. */
export interface NamePlace {
    book: number;
    row: number;
    column: number;
    /** Cells wide. One is usually too narrow to carry a name. */
    span: number;
}

export interface Layout {
    cells: Cell[];
    /** Grid rows needed. Height in points is this times the cell size. */
    rows: number;
    names: NamePlace[];
}

export function layoutCells(chapterCounts: number[], columns: number): Layout {
    if (columns < 1 || chapterCounts.length === 0) return { cells: [], rows: 0, names: [] };

    const cells: Cell[] = [];
    /* Which book owns each grid position, for the edge pass below. */
    const owner = new Map<string, number>();
    const key = (row: number, column: number) => `${row}:${column}`;

    let index = 0;
    chapterCounts.forEach((count, book) => {
        for (let chapter = 1; chapter <= count; chapter++) {
            const row = Math.floor(index / columns);
            const column = index % columns;
            owner.set(key(row, column), book);
            cells.push({
                book,
                chapter,
                column,
                row,
                edgeTop: false,
                edgeRight: false,
                edgeBottom: false,
                edgeLeft: false,
            });
            index++;
        }
    });

    /*
     * A second pass, because a cell cannot know its right-hand neighbour until
     * every cell exists — the book after it has not been laid out yet when it
     * is created.
     */
    const differs = (row: number, column: number, book: number) => owner.get(key(row, column)) !== book;
    for (const cell of cells) {
        cell.edgeTop = differs(cell.row - 1, cell.column, cell.book);
        cell.edgeBottom = differs(cell.row + 1, cell.column, cell.book);
        cell.edgeLeft = differs(cell.row, cell.column - 1, cell.book);
        cell.edgeRight = differs(cell.row, cell.column + 1, cell.book);
    }

    /*
     * A name goes on the longest unbroken horizontal run a book has, which for
     * most books is a full row of the grid and for the small ones is whatever
     * they got. Runs are found per row so a name never straddles a wrap.
     */
    const names: NamePlace[] = [];
    let cursor = 0;
    chapterCounts.forEach((count, book) => {
        const own = cells.slice(cursor, cursor + count);
        cursor += count;

        let best: NamePlace = { book, row: 0, column: 0, span: 0 };
        let runStart = 0;
        for (let position = 0; position <= own.length; position++) {
            /*
             * A run never breaks at its own first cell — `position > runStart`
             * guards the look-back, which would otherwise read the cell before
             * the book started.
             */
            const broken =
                position === own.length ||
                (position > runStart &&
                    (own[position].row !== own[runStart].row ||
                        own[position].column !== own[position - 1].column + 1));
            if (broken) {
                const span = position - runStart;
                if (span > best.span) {
                    best = { book, row: own[runStart].row, column: own[runStart].column, span };
                }
                runStart = position;
            }
        }
        if (best.span > 0) names.push(best);
    });

    return { cells, rows: Math.ceil(index / columns), names };
}
