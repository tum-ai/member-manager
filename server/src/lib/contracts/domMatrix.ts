/**
 * pdf.js needs `globalThis.DOMMatrix`, which Node does not provide. Its own
 * fallback borrows one from `@napi-rs/canvas`, an optional dependency it loads
 * through a platform-conditional `require()` built from `createRequire`. Vercel
 * file tracing cannot follow that, so the native package never reaches the
 * deployed function and `const SCALE_MATRIX = new DOMMatrix()` at pdf.js module
 * scope throws "DOMMatrix is not defined" — in production only, because a dev
 * machine has the package installed.
 *
 * Installing this implementation before pdf.js loads means dev, CI and Vercel
 * all run the same matrix code, so the test suite actually covers production.
 */

/** A 2D affine transform in PDF order: `[a, b, c, d, e, f]`. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY_MATRIX: Matrix = [1, 0, 0, 1, 0, 0];

/**
 * `left * right` in column-vector convention: the result applies `right` first.
 * This is the composition PDF content streams use, where a `cm` operand is
 * combined into the current transform.
 */
export function multiply(left: Matrix, right: Matrix): Matrix {
	return [
		left[0] * right[0] + left[2] * right[1],
		left[1] * right[0] + left[3] * right[1],
		left[0] * right[2] + left[2] * right[3],
		left[1] * right[2] + left[3] * right[3],
		left[0] * right[4] + left[2] * right[5] + left[4],
		left[1] * right[4] + left[3] * right[5] + left[5],
	];
}

/** Returns null when the transform is singular and cannot be reversed. */
export function invert(matrix: Matrix): Matrix | null {
	const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
	if (determinant === 0 || !Number.isFinite(determinant)) return null;
	return [
		matrix[3] / determinant,
		-matrix[1] / determinant,
		-matrix[2] / determinant,
		matrix[0] / determinant,
		(matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant,
		(matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant,
	];
}

/**
 * The subset of `DOMMatrix` pdf.js touches. `translate` and `scale` return a new
 * matrix and the `*Self` methods mutate, matching the DOM, because pdf.js relies
 * on both behaviours.
 */
export class DomMatrix {
	a = 1;
	b = 0;
	c = 0;
	d = 1;
	e = 0;
	f = 0;
	readonly is2D = true;

	constructor(init?: ArrayLike<number> | null) {
		if (!init) return;
		// A 16-entry init is a 4x4 matrix; its 2D components sit at these offsets.
		const source: Matrix | null =
			init.length === 6
				? ([init[0], init[1], init[2], init[3], init[4], init[5]].map(
						Number,
					) as Matrix)
				: init.length === 16
					? ([init[0], init[1], init[4], init[5], init[12], init[13]].map(
							Number,
						) as Matrix)
					: null;
		if (!source) {
			throw new TypeError("DOMMatrix init must have 6 or 16 entries");
		}
		this.setMatrix(source);
	}

	get matrix(): Matrix {
		return [this.a, this.b, this.c, this.d, this.e, this.f];
	}

	multiplySelf(other: DomMatrixLike): this {
		return this.setMatrix(multiply(this.matrix, toMatrix(other)));
	}

	preMultiplySelf(other: DomMatrixLike): this {
		return this.setMatrix(multiply(toMatrix(other), this.matrix));
	}

	/** Per the DOM, a singular matrix inverts to all-NaN rather than throwing. */
	invertSelf(): this {
		const inverted = invert(this.matrix);
		return this.setMatrix(
			inverted ?? [
				Number.NaN,
				Number.NaN,
				Number.NaN,
				Number.NaN,
				Number.NaN,
				Number.NaN,
			],
		);
	}

	translate(tx = 0, ty = 0): DomMatrix {
		return new DomMatrix(multiply(this.matrix, [1, 0, 0, 1, tx, ty]));
	}

	scale(sx = 1, sy = sx): DomMatrix {
		return new DomMatrix(multiply(this.matrix, [sx, 0, 0, sy, 0, 0]));
	}

	private setMatrix(matrix: Matrix): this {
		[this.a, this.b, this.c, this.d, this.e, this.f] = matrix;
		return this;
	}
}

interface DomMatrixLike {
	a?: number;
	b?: number;
	c?: number;
	d?: number;
	e?: number;
	f?: number;
}

function toMatrix(value: DomMatrixLike): Matrix {
	return [
		value.a ?? 1,
		value.b ?? 0,
		value.c ?? 0,
		value.d ?? 1,
		value.e ?? 0,
		value.f ?? 0,
	];
}

/**
 * Node never defines `DOMMatrix`, so calling this before pdf.js is imported wins
 * the race against its `@napi-rs/canvas` fallback in every environment.
 */
export function installDomMatrixPolyfill(): void {
	const target = globalThis as { DOMMatrix?: unknown };
	if (target.DOMMatrix === undefined) {
		target.DOMMatrix = DomMatrix;
	}
}
