
/* ********************************************************************************************************************
 * App Options
 * ********************************************************************************************************************/

export type TSPOptions = { [K in keyof typeof defaultOptions]: (typeof defaultOptions)[K] }

export const defaultOptions = {
  silent: true,
  verbose: false,
  basedir: process.cwd()
};