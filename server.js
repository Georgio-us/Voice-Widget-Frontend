const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

// Разрешаем CORS для всех доменов, чтобы виджет грузился на любых сайтах
app.use(cors());

// Runtime config for widget deployment (Railway env-driven)
app.get('/runtime-config.js', (req, res) => {
    const runtimeConfig = {
        apiUrl: process.env.WIDGET_API_URL || '',
        assetsBase: process.env.WIDGET_ASSETS_BASE || '',
        defaultTheme: process.env.WIDGET_DEFAULT_THEME || ''
    };
    res.type('application/javascript');
    res.send(
        `window.__VW_API_URL__ = ${JSON.stringify(runtimeConfig.apiUrl)};\n` +
        `window.__VW_ASSETS_BASE__ = ${JSON.stringify(runtimeConfig.assetsBase)};\n` +
        `window.__VW_DEFAULT_THEME__ = ${JSON.stringify(runtimeConfig.defaultTheme)};\n`
    );
});

// Раздаем статические файлы из текущей директории
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Frontend server is running on port ${PORT}`);
});
