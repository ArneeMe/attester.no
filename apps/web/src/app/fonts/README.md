# Fonts

Self-hosted so no request reaches Google, at build time or runtime. Loaded by
`src/app/style/landingFonts.ts`. Monospace is the system stack, no file.

| File | Family | Licence |
| --- | --- | --- |
| `source-serif-4-latin-variable.woff2` | Source Serif 4, 400–600 | OFL 1.1 |
| `ibm-plex-sans-latin-variable.woff2` | IBM Plex Sans, 400–700 | OFL 1.1 |

The `LICENSE-*` files must stay with the fonts. To refresh:

```sh
npm i -D @fontsource-variable/source-serif-4 @fontsource-variable/ibm-plex-sans
cp node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2 src/app/fonts/source-serif-4-latin-variable.woff2
cp node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2 src/app/fonts/ibm-plex-sans-latin-variable.woff2
npm uninstall @fontsource-variable/source-serif-4 @fontsource-variable/ibm-plex-sans
```
