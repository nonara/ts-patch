import crypto from "crypto";


/* ****************************************************************************************************************** */
// region: Type Helpers
/* ****************************************************************************************************************** */

/**
 * Make certain properties partial
 */
export type PartialSome<T, K extends keyof T> = Omit<T, K> & Pick<Partial<T>, K>

// endregion


/* ****************************************************************************************************************** */
// region: General Helpers
/* ****************************************************************************************************************** */

export function getHash(fileContent: string) {
  return crypto.createHash('md5').update(fileContent).digest('hex');
}

// endregion
