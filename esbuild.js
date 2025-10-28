import esbuild from 'esbuild'
import textReplace from 'esbuild-plugin-text-replace'

await esbuild.build(
    {
        entryPoints: ['src/index.ts'],
        outfile: 'bin/index.cjs',
        bundle: true,
        platform: 'node',
        format: 'cjs',
        minify: true,
        sourcemap: 'inline',
        define: {
            'import.meta': '_importMeta',
        },
        banner: {
            'js': "const _importMeta={url:require('node:url').pathToFileURL(__filename)}; _importMeta.resolve=require('node:module').createRequire(_importMeta.url);",
        },
        plugins: [
            textReplace(
                {
                    include: /esm.mjs/,
                    pattern:[
                        [/(?<=["'])\.\.\/\.\.\/\.\.\/locales(?=["'])/g, "../locales"],
                    ]
                }
            )
        ],
    }
)
