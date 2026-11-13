/**
 * Global JSON.parse patch to handle invalid string values in legacy JSONB data.
 * Import before initializing the database client so driver JSON parsers use it.
 */

if (typeof JSON !== "undefined" && typeof JSON.parse === "function") {
  const originalParse = JSON.parse;

  JSON.parse = function (this: unknown, text: unknown, reviver?: any) {
    if (text === null || text === undefined) return null;
    const str = String(text).trim();

    if (
      str === "undefined" ||
      str === "null" ||
      str === "" ||
      str === '"undefined"' ||
      str === '"null"' ||
      str === '""'
    ) {
      return null;
    }

    try {
      return originalParse.call(this, text as any, reviver);
    } catch (error) {
      return null;
    }
  } as any;
}

export {}; // Ensure this file is treated as a module
