import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DomMatrix,
	IDENTITY_MATRIX,
	installDomMatrixPolyfill,
	invert,
	type Matrix,
	multiply,
} from "../../src/lib/contracts/domMatrix.js";

const SCALE_THEN_TRANSLATE: Matrix = [2, 0, 0, 3, 10, 20];

function assertMatrix(actual: Matrix, expected: Matrix) {
	actual.forEach((value, index) => {
		assert.ok(
			Math.abs(value - expected[index]) < 1e-9,
			`index ${index}: ${value} !== ${expected[index]}`,
		);
	});
}

describe("multiply", () => {
	it("leaves a matrix unchanged when composed with the identity", () => {
		assertMatrix(
			multiply(SCALE_THEN_TRANSLATE, IDENTITY_MATRIX),
			SCALE_THEN_TRANSLATE,
		);
		assertMatrix(
			multiply(IDENTITY_MATRIX, SCALE_THEN_TRANSLATE),
			SCALE_THEN_TRANSLATE,
		);
	});

	it("applies the right operand first", () => {
		// Scaling by 2 and then translating by (1, 1) moves the origin to (1, 1);
		// translating first puts it at (2, 2). Order has to survive composition,
		// because an anchor box is derived from the composed content-stream matrix.
		const scale: Matrix = [2, 0, 0, 2, 0, 0];
		const translate: Matrix = [1, 0, 0, 1, 1, 1];
		assertMatrix(multiply(translate, scale), [2, 0, 0, 2, 1, 1]);
		assertMatrix(multiply(scale, translate), [2, 0, 0, 2, 2, 2]);
	});
});

describe("invert", () => {
	it("round-trips a matrix back to the identity", () => {
		const inverted = invert(SCALE_THEN_TRANSLATE);
		assert.ok(inverted);
		assertMatrix(multiply(SCALE_THEN_TRANSLATE, inverted), IDENTITY_MATRIX);
	});

	it("returns null for a singular matrix", () => {
		assert.equal(invert([0, 0, 0, 0, 0, 0]), null);
		assert.equal(invert([1, 2, 2, 4, 0, 0]), null);
	});
});

describe("DomMatrix", () => {
	it("defaults to the identity", () => {
		assertMatrix(new DomMatrix().matrix, IDENTITY_MATRIX);
	});

	it("accepts 6-entry and 16-entry initialisers", () => {
		assertMatrix(
			new DomMatrix(SCALE_THEN_TRANSLATE).matrix,
			SCALE_THEN_TRANSLATE,
		);
		// 4x4 column-major, carrying the same 2D components.
		const matrix4x4 = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1];
		assertMatrix(new DomMatrix(matrix4x4).matrix, SCALE_THEN_TRANSLATE);
	});

	it("rejects an initialiser of the wrong length", () => {
		assert.throws(() => new DomMatrix([1, 2, 3]), TypeError);
	});

	it("multiplies in both directions", () => {
		const translate = new DomMatrix([1, 0, 0, 1, 1, 1]);
		assertMatrix(
			new DomMatrix([2, 0, 0, 2, 0, 0]).multiplySelf(translate).matrix,
			[2, 0, 0, 2, 2, 2],
		);
		assertMatrix(
			new DomMatrix([2, 0, 0, 2, 0, 0]).preMultiplySelf(translate).matrix,
			[2, 0, 0, 2, 1, 1],
		);
	});

	it("inverts in place and yields NaN for a singular matrix", () => {
		assertMatrix(
			new DomMatrix(SCALE_THEN_TRANSLATE).invertSelf().matrix,
			invert(SCALE_THEN_TRANSLATE) ?? IDENTITY_MATRIX,
		);
		const singular = new DomMatrix([0, 0, 0, 0, 0, 0]).invertSelf();
		assert.ok(Number.isNaN(singular.a));
		assert.ok(Number.isNaN(singular.f));
	});

	it("returns a new matrix from translate and scale without mutating", () => {
		const base = new DomMatrix(SCALE_THEN_TRANSLATE);
		const translated = base.translate(5, 5);
		const scaled = base.scale(2);
		assertMatrix(base.matrix, SCALE_THEN_TRANSLATE);
		assert.notEqual(translated, base);
		assertMatrix(translated.matrix, [2, 0, 0, 3, 20, 35]);
		assertMatrix(scaled.matrix, [4, 0, 0, 6, 10, 20]);
	});
});

describe("installDomMatrixPolyfill", () => {
	it("installs the polyfill and never replaces an existing implementation", () => {
		const target = globalThis as { DOMMatrix?: unknown };
		const original = target.DOMMatrix;
		try {
			delete target.DOMMatrix;
			installDomMatrixPolyfill();
			assert.equal(target.DOMMatrix, DomMatrix);

			const native = class {};
			target.DOMMatrix = native;
			installDomMatrixPolyfill();
			assert.equal(target.DOMMatrix, native);
		} finally {
			if (original === undefined) delete target.DOMMatrix;
			else target.DOMMatrix = original;
		}
	});
});
