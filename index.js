process.chdir(__dirname);

const Promise = require('bluebird');
const cheerio = require('cheerio');
const fs = Promise.promisifyAll(require('fs-extra'), {
  multiArgs: true,
});
const request = require('request-promise');
const sqlite3 = require('sqlite3').verbose();

const DOC_NAME = 'DOC_NAME';
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


function getType(text) {
  // ['Method', 'Function', 'Class', 'Guide'];
  return text;
}

function getApiListFromDom($) {
  let items = $('#get-items');
  let arr = [];

  items.each((index, ele) => {
    arr.push({
      text: ele['api key'],
      type: getType(ele['function key']),
      path: 'xxx.html#id',
    });
  });

  return arr;
}


async function init() {
  console.log('mkdir -p');
  await fs.removeAsync(dirInit);
  await fs.mkdirpAsync(dirStruct);

  console.log('Copying resources...');
  await fs.copyAsync('Info.plist', plistPath);
  await fs.copyAsync('icon.png', iconPath);

  console.log('request html...');
  let html = await request({ url: '' });

  console.log('Parsing the DOM into SQL Index...');
  let $ = cheerio.load(html);
  let apiList = getApiListFromDom($);
  createDatabase(apiList);

  console.log('Adding user define styles...');
  let style = await fs.readFileAsync(stylePath);
  await fs.writeFile(docIndexPath, `${style}${html}`);
}


init()
  .then(() => {
    console.log('done');
  })
  .catch((e) => {
    console.dir(e, { showHidden: true, depth: null, colors: true });
  });
