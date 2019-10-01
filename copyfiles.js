const fs = require('fs')
const path = require('path')
fs.copyFileSync(path.join(__dirname, 'src', 'public', 'robots.txt'), path.join(__dirname, 'app', 'public', 'robots.txt'))
console.log('robots.txt exists: ', fs.existsSync(path.join(__dirname, 'app', 'public', 'robots.txt')))

if (!fs.existsSync(path.join(__dirname, 'app', 'public', 'images'))) fs.mkdirSync(path.join(__dirname, 'app', 'public', 'images'))
// fs.copyFileSync(path.join(__dirname, 'src', 'public', 'images', 'about-1.png'), path.join(__dirname, 'app', 'public', 'images', 'about-1.png'))
