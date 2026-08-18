/**
 * Small dense linear-algebra primitives for the 152-parameter Laplace model.
 *
 * These deliberately avoid a numerical dependency: all operations are tiny,
 * deterministic, and have explicit dimension checks at the model boundary.
 */
export type Vector = readonly number[];
export type Matrix = readonly (readonly number[])[];

export class LinearAlgebraError extends Error {
  readonly code: 'dimension-mismatch' | 'non-finite' | 'not-positive-definite';

  constructor(code: LinearAlgebraError['code'], message: string) {
    super(message);
    this.name = 'LinearAlgebraError';
    this.code = code;
  }
}

function assertFinite(value: number, context: string) {
  if (!Number.isFinite(value)) throw new LinearAlgebraError('non-finite', `${context} must be finite.`);
}

function assertSquare(matrix: Matrix) {
  if (matrix.length === 0 || matrix.some((row) => row.length !== matrix.length)) {
    throw new LinearAlgebraError('dimension-mismatch', 'Matrix must be non-empty and square.');
  }
}

export function createVector(length: number, initial = 0): number[] {
  if (!Number.isInteger(length) || length < 0) throw new LinearAlgebraError('dimension-mismatch', 'Vector length must be a non-negative integer.');
  assertFinite(initial, 'Vector initial value');
  return Array.from({ length }, () => initial);
}

export function createMatrix(size: number, initial = 0): number[][] {
  if (!Number.isInteger(size) || size < 1) throw new LinearAlgebraError('dimension-mismatch', 'Matrix size must be a positive integer.');
  return Array.from({ length: size }, () => createVector(size, initial));
}

export function dot(left: Vector, right: Vector): number {
  if (left.length !== right.length) throw new LinearAlgebraError('dimension-mismatch', 'Dot-product vectors must have equal length.');
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const value = left[index]! * right[index]!;
    assertFinite(value, 'Dot-product term');
    total += value;
  }
  assertFinite(total, 'Dot product');
  return total;
}

export function maxAbsolute(values: Vector): number {
  return values.reduce((maximum, value) => {
    assertFinite(value, 'Vector value');
    return Math.max(maximum, Math.abs(value));
  }, 0);
}

export function multiplyMatrixVector(matrix: Matrix, vector: Vector): number[] {
  if (matrix.some((row) => row.length !== vector.length)) {
    throw new LinearAlgebraError('dimension-mismatch', 'Matrix columns must equal vector length.');
  }
  return matrix.map((row) => dot(row, vector));
}

/** Adds `scale * vector * vectorᵀ` to a square matrix in place. */
export function addScaledOuterProduct(matrix: number[][], vector: Vector, scale: number): void {
  assertSquare(matrix);
  if (matrix.length !== vector.length) throw new LinearAlgebraError('dimension-mismatch', 'Outer-product vector must match matrix size.');
  assertFinite(scale, 'Outer-product scale');
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < matrix.length; column += 1) {
      matrix[row]![column]! += scale * vector[row]! * vector[column]!;
    }
  }
}

export function addDiagonal(matrix: Matrix, value: number): number[][] {
  assertSquare(matrix);
  assertFinite(value, 'Diagonal value');
  return matrix.map((row, rowIndex) => row.map((cell, columnIndex) => {
    assertFinite(cell, 'Matrix value');
    return rowIndex === columnIndex ? cell + value : cell;
  }));
}

/** Returns lower-triangular L such that A = L Lᵀ. */
export function cholesky(matrix: Matrix): number[][] {
  assertSquare(matrix);
  const size = matrix.length;
  const lower = createMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      const source = matrix[row]![column]!;
      const mirrored = matrix[column]![row]!;
      assertFinite(source, 'Matrix value');
      assertFinite(mirrored, 'Matrix value');
      // The Hessian is symmetric by construction. A small numerical asymmetry is
      // averaged deterministically; a material asymmetry is a caller error.
      if (Math.abs(source - mirrored) > 1e-10) {
        throw new LinearAlgebraError('dimension-mismatch', 'Cholesky requires a symmetric matrix.');
      }
      let sum = (source + mirrored) / 2;
      for (let index = 0; index < column; index += 1) sum -= lower[row]![index]! * lower[column]![index]!;
      if (row === column) {
        if (!(sum > 0) || !Number.isFinite(sum)) {
          throw new LinearAlgebraError('not-positive-definite', 'Matrix is not positive definite.');
        }
        lower[row]![column] = Math.sqrt(sum);
      } else {
        const pivot = lower[column]![column]!;
        if (!(pivot > 0) || !Number.isFinite(pivot)) throw new LinearAlgebraError('not-positive-definite', 'Cholesky pivot is invalid.');
        lower[row]![column] = sum / pivot;
      }
    }
  }
  return lower;
}

/** Solves Lx = b for a lower triangular matrix. */
export function solveLower(lower: Matrix, vector: Vector): number[] {
  assertSquare(lower);
  if (lower.length !== vector.length) throw new LinearAlgebraError('dimension-mismatch', 'Lower solve dimensions differ.');
  const output = createVector(vector.length);
  for (let row = 0; row < lower.length; row += 1) {
    let value = vector[row]!;
    for (let column = 0; column < row; column += 1) value -= lower[row]![column]! * output[column]!;
    const pivot = lower[row]![row]!;
    if (!(pivot > 0) || !Number.isFinite(pivot)) throw new LinearAlgebraError('not-positive-definite', 'Lower solve pivot is invalid.');
    output[row] = value / pivot;
  }
  return output;
}

/** Solves Lᵀx = b for a lower triangular L. */
export function solveUpperFromLower(lower: Matrix, vector: Vector): number[] {
  assertSquare(lower);
  if (lower.length !== vector.length) throw new LinearAlgebraError('dimension-mismatch', 'Upper solve dimensions differ.');
  const output = createVector(vector.length);
  for (let row = lower.length - 1; row >= 0; row -= 1) {
    let value = vector[row]!;
    for (let column = row + 1; column < lower.length; column += 1) value -= lower[column]![row]! * output[column]!;
    const pivot = lower[row]![row]!;
    if (!(pivot > 0) || !Number.isFinite(pivot)) throw new LinearAlgebraError('not-positive-definite', 'Upper solve pivot is invalid.');
    output[row] = value / pivot;
  }
  return output;
}

/** Solves Ax = b when A = L Lᵀ. */
export function solveCholesky(lower: Matrix, vector: Vector): number[] {
  return solveUpperFromLower(lower, solveLower(lower, vector));
}

export function quadraticFormFromCholesky(lower: Matrix, vector: Vector): number {
  return dot(vector, solveCholesky(lower, vector));
}
