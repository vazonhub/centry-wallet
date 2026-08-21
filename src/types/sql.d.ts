/**
 * Ambient module for raw `.sql` imports. At build time
 * `babel-plugin-inline-import` replaces the import with the file's contents as
 * a string literal (see babel.config.js). This declaration only satisfies the
 * TypeScript type checker.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
