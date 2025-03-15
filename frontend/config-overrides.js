const path = require('path');

module.exports = function override(config, env) {
    config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf'
    };

    config.module.rules.push({
        test: /\.m?js$/,
        resolve: {
            fullySpecified: false
        }
    });

    // Add mjs support
    config.module.rules.push({
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto"
    });

    return config;
};