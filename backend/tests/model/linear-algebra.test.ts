import { describe, expect, it } from 'vitest';
import {
  addScaledOuterProduct,
  cholesky,
  createMatrix,
  dot,
  LinearAlgebraError,
  multiplyMatrixVector,
  solveCholesky,
  solveLower,
  solveUpperFromLower,
} from '../../src/model/linear-algebra.js';

describe('model linear algebra', () => {
  it('factors and solves a known positive-definite system', () => {
    const matrix = [[4, 2], [2, 3]];
    const lower = cholesky(matrix);
    expect(lower[0]![0]).toBeCloseTo(2);
    expect(lower[1]![0]).toBeCloseTo(1);
    expect(lower[1]![1]).toBeCloseTo(Math.sqrt(2));
    const solution = solveCholesky(lower, [6, 5]);
    expect(solution[0]).toBeCloseTo(1);
    expect(solution[1]).toBeCloseTo(1);
    expect(multiplyMatrixVector(matrix, solution)).toEqual(expect.arrayContaining([expect.closeTo(6), expect.closeTo(5)]));
  });

  it('solves triangular systems and builds a weighted outer product', () => {
    const lower = [[2, 0], [1, 3]];
    expect(solveLower(lower, [2, 7])).toEqual([1, 2]);
    expect(solveUpperFromLower(lower, [3, 6])).toEqual([0.5, 2]);
    const precision = createMatrix(2);
    addScaledOuterProduct(precision, [2, -1], 0.25);
    expect(precision).toEqual([[1, -0.5], [-0.5, 0.25]]);
    expect(dot([2, -1], [2, -1])).toBe(5);
  });

  it('fails explicitly for invalid dimensions and non-positive definite matrices', () => {
    expect(() => cholesky([[1, 2], [2, 1]])).toThrowError(LinearAlgebraError);
    expect(() => dot([1], [1, 2])).toThrow(/equal length/);
  });
});
