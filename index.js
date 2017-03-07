process.chdir(__dirname);

/* start 需要配置内容 */
// 文档html获取URL
const DOC_URL = 'https://amery2010.gitbooks.io/nodejs-api-doc-cn/appendix/functions_glossary.html';
// 文档在 dash 中显示的名称
const DOC_NAME = 'nodejs-zh';
// 以及方法 getApiListFromDom
//   和方法 buildHtml
//   和图片 icon.png
/* end 需要配置内容 */

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs-extra'));
const request = require('request-promise');
const sqlite3 = require('sqlite3').verbose();
const url = require('url');
const path = require('path');


const docIndexPath = `${DOC_NAME}.docset/Contents/Resources/Documents/index.html`;
const dbPath = `${DOC_NAME}.docset/Contents/Resources/docSet.dsidx`;
const dirInit = `${DOC_NAME}.docset`;
const dirStruct = `${DOC_NAME}.docset/Contents/Resources/Documents/`;
const plistPath = `${DOC_NAME}.docset/Contents/Info.plist`;
const iconPath = `${DOC_NAME}.docset/icon.png`;
const stylePath = 'style.css';


const baseUrl = 'https://amery2010.gitbooks.io/nodejs-api-doc-cn/';
const cachePage = {};


function getDetailPageHtml(url) {
  return request(
    {
      url: url
    })
    .then((html) => {
      return cheerio.load(html)
    })
    .then(($) => {
      return $('.markdown-section').html();
    });
}

function getApiListFromDom($) {
  let result = [];
  $('.markdown-section p').each((index, ele) => {
    let name = $(ele).text();
    let href = url.resolve(DOC_URL, $(ele).find('a').first().attr('href'));
    let methodPath = href.replace(baseUrl, '');
    let writePath = path.join(dirStruct, methodPath.replace(/#.*/, ''));

    result.push({
      href: href.replace(/#.*/, ''),
      name: name,
      methodPath: methodPath,
      writePath: writePath,
    });
  });

  return fs.readFileAsync(stylePath, 'utf8')
    .then((styles) => {
      return Promise.map(result, (obj) => {
        return Promise.try(() => {
          if (cachePage[obj.writePath]) {
            return undefined;
          }
          cachePage[obj.writePath] = true;

          return fs.ensureFileAsync(obj.writePath)
            .then(() => {
              console.info('get page: ', obj.href);
              return getDetailPageHtml(obj.href);
            })
            .then((data) => {
              return fs.writeFileAsync(obj.writePath, `
              <!DOCTYPE html>
                <html class="docs">
                  <head>
                    <style>${styles}</style>
                  </head>
                  <body>
                  <section class="normal markdown-section">
                    ${data}
                    </section>
                  </body>
                </html>
              `);
            });
        })
          .then(() => {
            return {
              text: obj.name,
              type: 'Method',
              path: obj.methodPath,
            };
          });
      }, {concurrency: 10});
    });
}

async function buildHtml($) {
  console.log('building html...');

  let mainHtml = $('.markdown-section').html().replace(/href="\.\.\//gi, 'href="');
  let style = await fs.readFileAsync(stylePath, 'utf8');
  await fs.writeFileAsync(docIndexPath,
    `<!DOCTYPE html>
      <html class="docs">
        <head>
          <title>${DOC_NAME}</title>
          <style>${style}</style>
        </head>
        <body>
        <section class="normal markdown-section">
          ${mainHtml}
        </section>
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
  let apiList = await getApiListFromDom($);
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
