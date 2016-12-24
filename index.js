process.chdir(__dirname);

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs-extra'));
const request = require('request-promise');
const sqlite3 = require('sqlite3').verbose();

const DOC_URL = 'http://www.css88.com/doc/lodash/';
const DOC_NAME = 'lodash-zh-4.16.1';
const docIndexPath = `${DOC_NAME}.docset/Contents/Resources/Documents/index.html`;

const dbPath = `${DOC_NAME}.docset/Contents/Resources/docSet.dsidx`;
const dirInit = `${DOC_NAME}.docset`;
const dirStruct = `${DOC_NAME}.docset/Contents/Resources/Documents/`;
const plistPath = `${DOC_NAME}.docset/Contents/Info.plist`;
const iconPath = `${DOC_NAME}.docset/icon.png`;
const stylePath = 'style.css';


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

function getApiListFromDom($) {
  let apiList = [];
  $('body').first().find('header').remove();
  $('.doc-container-tipbox').first().remove();
  $('head').remove();
  $('script').remove();

  $('.toc-container').first().find('li').each((index, ele) => {
    let id = $(ele).find('a').first().attr('href')
      .replace(/.*?#/, '#');
    let text = $(ele).text();
    let newId = text.replace('_.', '');
    $(id).attr('id', newId);
    apiList.push({
      text,
      type: 'Method',
      path: `index.html#${newId}`,
    });
  });
  $('.toc-container').remove();
  return apiList;
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

  console.log('Adding user define styles...');
  let mainHtml = $('body').html().replace(/&#x611A;&#x4EBA;&#x7801;&#x5934;/gi, '');
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


init()
  .then(() => {
    console.log('done');
  })
  .catch((e) => {
    console.dir(e, { showHidden: true, depth: null, colors: true });
  });
