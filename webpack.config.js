const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const PathsPlugin = require("tsconfig-paths-webpack-plugin").default;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const autoprefixer = require('autoprefixer');
const sveltePreprocess = require("svelte-preprocess");

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
                    preprocess: sveltePreprocess({
                        tsconfigFile: "tsconfig.json",
                        sourceMap: true,
                        scss: true,
                        sass: true,
                        postcss: {
                            plugins: [
                                autoprefixer
                            ]
                        }
                    }),
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