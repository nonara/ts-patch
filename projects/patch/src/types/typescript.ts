/* ****************************************************************************************************************** *
 * Added Properties
 * ****************************************************************************************************************** */

/** @build-types */
declare namespace ts {
  /** @internal */
  const createProgram: typeof import('typescript').createProgram;

  export const originalCreateProgram: typeof ts.createProgram;
}
