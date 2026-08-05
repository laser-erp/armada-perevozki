#!/usr/bin/env node
/**
 * www — только заглушка. Рабочая программа всегда с сервера
 * (capacitor.config.json → server.url = http://aptown1.fvds.ru/).
 */
const fs = require('fs');
const path = require('path');

const dst = path.resolve(__dirname, '../www');
fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(
  path.join(dst, 'index.html'),
  `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>АРМАДА</title>
<style>html,body{margin:0;height:100%;background:#000;color:#aaa;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}</style>
<script>location.replace('http://aptown1.fvds.ru/');</script>
</head><body><p>Загрузка АРМАДА…</p></body></html>
`
);
console.log('www: stub → live web (aptown1.fvds.ru)');
