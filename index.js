process.chdir(__dirname);


/* start 需要配置内容 */
// 文档html获取URL
const DOC_URL = 'DOC_URL';
// 文档在 dash 中显示的名称
const DOC_NAME = 'DOC_NAME';
// 以及方法 getApiListFromDom
//   和方法 buildHtml
//   和图片 icon.png
/* end 需要配置内容 */

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs-extra'));
const request = require('request-promise');
const sqlite3 = require('sqlite3').verbose();


const docIndexPath = `${DOC_NAME}.docset/Contents/Resources/Documents/index.html`;
const dbPath = `${DOC_NAME}.docset/Contents/Resources/docSet.dsidx`;
const dirInit = `${DOC_NAME}.docset`;
const dirStruct = `${DOC_NAME}.docset/Contents/Resources/Documents/`;
const plistPath = `${DOC_NAME}.docset/Contents/Info.plist`;
const iconPath = `${DOC_NAME}.docset/icon.png`;
const stylePath = 'style.css';


function getApiListFromDom($) {
  let apiList = [];

  $('.DOC_NAME').each((index, ele) => {
    apiList.push({
      text: $(ele).text(),
      type: 'Method',
      path: 'index.html#id',
    });
  });
  return apiList;
}

async function buildHtml($) {
  console.log('building html...');

  let mainHtml = $('body').html();
  let style = await fs.readFileAsync(stylePath, 'utf8');
  await fs.writeFile(docIndexPath,
    `<!DOCTYPE html>
      <html class="docs">
        <head>
          <title>${DOC_NAME}</title>
          <style>${style}</style>
        </head>
        <body>
          ${mainHtml}
        </body>
      </html>
     `
  );
}

function createDatabase(apiList) {
  const db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    db.run('CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, type TEXT, path TEXT);');
    db.run('CREATE UNIQUE INDEX anchor ON searchIndex (name,type,path);');

    let stmt = db.prepare('INSERT OR IGNORE INTO ' +
      'searchIndex(name, type, path) ' +
      'VALUES (?, ?, ?)');

    apiList.forEach(({ text, type, path }) => {
      stmt.run(text, type, path);
    });

    stmt.finalize();
  });

  db.close();
}

async function init() {
  console.log('mkdir -p...');
  await fs.removeAsync(dirInit);
  await fs.mkdirpAsync(dirStruct);

  console.log('Copying resources...');
  let plistInfo = await fs.readFileAsync('Info.plist', 'utf8');
  plistInfo = plistInfo.replace(/DOC_NAME/gi, DOC_NAME);

  await fs.writeFile(plistPath, plistInfo);
  await fs.copyAsync('icon.png', iconPath);

  console.log('request html...');
  let html = await request(DOC_URL);

  console.log('Parsing the DOM into SQL Index...');
  let $ = cheerio.load(html);
  let apiList = getApiListFromDom($);
  createDatabase(apiList);

  await buildHtml($);
}


init()
  .then(() => {
    console.log('done');
  })
  .catch((e) => {
    console.dir(e, { showHidden: true, depth: null, colors: true });
  });
