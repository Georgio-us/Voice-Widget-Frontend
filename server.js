const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();

// Разрешаем CORS для всех доменов, чтобы виджет грузился на любых сайтах
app.use(cors());

// Раздаем статические файлы из текущей директории
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Frontend server is running on port ${PORT}`);
});
