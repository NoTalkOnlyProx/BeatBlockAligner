# Setup Notes
I seem to constantly be setting up Typescript + Webpack + Babel + Svelte.
Here is the process to do so from scratch.


### Install Webpack
```
npm install --include=dev webpack webpack-cli
```

### Install Babel:
```
npm install --include=dev @babel/core @babel/preset-env
```

## Install Svelte
```
npm install --include=dev svelte @tsconfig/svelte
```

### Install Integrations, devtools
```
npm install --include=dev rimraf html-webpack-plugin css-loader mini-css-extract-plugin
npm install --include=dev ts-loader tsconfig-paths-webpack-plugin
npm install --include=dev svelte-loader svelte-preprocess
npm install --include=dev babel-loader
```

# Required files

Writing these here because sometimes plaintext is nice.
Hypothetically, cloning this repo's initial commit and then reinitializing git will be a viable setup strategy in the
future.

##### `src/global.d.ts`

```ts
/// <reference types="svelte" />

//See https://github.com/tsconfig/bases/commit/1e0ca8cebd191ff39b16c0f3b701ed84a892bb5b
```

##### `tsconfig.json`
```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "include": ["src/**/*"],
  "exclude": ["node_modules/*"],
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "src/*": ["src/*"],
    },
    "moduleResolution": "node"
  },
}
```

##### `svelte.config.js`
```js
const sveltePreprocess = require("svelte-preprocess");

const createSveltePreprocessor = () => {
    return sveltePreprocess({
        tsconfigFile: "tsconfig.json",
        sourceMap: true,
    });
};

module.exports = {
    preprocess: createSveltePreprocessor(),
    createSveltePreprocessor,
};
```

##### `.babelrc`
```json
{
  "presets": [
    "@babel/preset-env"
  ]
}
```

##### `.gitignore`
```
node_modules
dist
.idea
.vscode
```

##### `webpack.config.js`
```js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {createSveltePreprocessor} = require("./svelte.config");
const PathsPlugin = require("tsconfig-paths-webpack-plugin").default;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'development',
    entry: {
        'aligner': './src/aligner/aligner.ts',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: './',
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.svelte$/,
                loader: 'svelte-loader',
                options: {
                    emitCss: false,
                    preprocess: createSveltePreprocessor(),
                }
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader,'css-loader'],
            },
            {
                test: /\.(jpg|jpeg|png|svg)$/,
                use: 'file-loader',
            },
            {
                test: /node_modules\/svelte\/.*\.mjs$/,
                resolve: {
                    fullySpecified: false,
                },
            },
        ],
    },
    resolve: {
        alias: {
            svelte: path.resolve('node_modules', 'svelte/src/runtime'),
        },
        conditionNames:['svelte','require','node'],
        extensions: [".mjs", ".js", ".ts", ".svelte"],
        mainFields: ["svelte", "browser", "module", "main"],
        plugins: [
            new PathsPlugin({
                extensions: [".mjs", ".js", ".ts", ".svelte"],
            }),
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src/aligner/aligner.html'),
            filename: "[name].html",
        }),
        new MiniCssExtractPlugin()
    ],
};
```

# Scripts (package.json)

```
  "scripts": {
    "build": "rimraf dist && webpack",
    "monitor": "nodemon -e ts,js,mjs,cjs,json,html,svelte,css --watch src --exec npm run build"
  },
```