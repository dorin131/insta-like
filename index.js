const chromium = require('chrome-aws-lambda');
const AWS = require('aws-sdk');
const AdmZip = require('adm-zip');
const fs = require('fs');

const S3_BUCKET = 'dorin-lambdas';

AWS.config.update({ region: process.env.AWS_REGION });
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

exports.handler = async (event, context, callback) => {
  console.log('--------- INSTAGRAM LIKE AUTOMATOR ----------');

  let browser = null;
  const like_count = 11;

  try {
    chromium.headless && await loadUserData()

    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      userDataDir: '/tmp/user_data',
    });

    let page = await browser.newPage();

    // ------START-----

    const navigationPromise = page.waitForNavigation()

    await page.goto('https://www.instagram.com/')

    await page.setViewport({ width: 1435, height: 742 })

    await navigationPromise

    // "Accept cookies from Instagram on this browser?"
    await clickElementWithText(page, 'button', 'Accept')

    await navigationPromise

    await logIn(page)

    await navigationPromise

    // "Save Your Login Info?"
    await clickElementWithText(page, 'button', 'Not Now')

    await navigationPromise

    await page.goto('https://www.instagram.com/explore/tags/beer/')
    const hrefs = await page.$$eval('a', as => as.map(a => a.href));
    const ten_recent_hrefs = hrefs.slice(9, 9 + like_count)

    for (let i = 0; i < like_count; i++) {
      const href = ten_recent_hrefs[i]
      console.log('Recent: ' + href)
      await page.goto(href)

      // Double-click to Like
      await page.mouse.click(400, 400, { clickCount: 2 })
    }

    // ------END-------

    chromium.headless && await saveUserData()

  } catch (error) {
    console.log('Unexpected error:', error);
    return callback(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  return callback(null, 'Success');
}

async function logIn(page) {
  const USER = process.env.ig_user
  const PASS = process.env.ig_pass

  if (!USER || !PASS) throw 'Could not get credentials'

  try {
    await page.waitForXPath("//div[text()='Log In']", { timeout: 5000 })
    console.log('Login form found')
    const inputs = await page.$x('//input')
    const username = inputs[0]
    await username.type(USER, {delay: 50})
    const password = inputs[1]
    await password.type(PASS, {delay: 50})
    await page.keyboard.press('Enter')
    console.log('Logged in')
  } catch (e) {
    console.log(`Didn\'t log in`, e)
  }
}

async function clickElementWithText(page, element, text) {
  const xpath = `//${element}[text()='${text}']`
  try {
    await page.waitForXPath(xpath, { timeout: 5000 })
    console.log('XPath found for ' + text)
    const elements = await page.$x(xpath)
    if (elements.length) {
      await elements[0].click()
      console.log('Clicked on: ' + text)
    } else {
      throw {}
    }
  } catch (e) {
    console.log('Couldn\'t click on: ' + text, e.name)
  }
}

async function loadUserData() {
  try {
    const readStream = (await s3.getObject({ Bucket: S3_BUCKET, Key: 'user_data.zip' }).promise()).createReadStream();
    const writeStream = fs.createWriteStream('/tmp/user_data.zip');
    readStream.pipe(writeStream);
    unzip('/tmp/user_data.zip', '/tmp/user_data');
  } catch (e) {
    console.log('Didn\'t load user data:', e)
  }
}

async function saveUserData() {
  try {
    zip('/tmp/user_data', '/tmp/user_data.zip');
    await uploadToS3(S3_BUCKET);
  } catch (e) {
    console.log('Didn\'t save user data:', e)
  }
}

async function uploadToS3(bucket) {
  const fileStream = fs.createReadStream('/tmp/user_data.zip');
  fileStream.on('error', function(err) {
    console.log('File Error', err);
  });
  await s3.upload({ Bucket: bucket, Key: 'user_data.zip', Body: fileStream }).promise()
}

function zip(path, fileName) {
  const zip = new AdmZip();
  zip.addLocalFolder(path, '', /^(.(?!Cache))*$/);
  zip.writeZip(fileName);
}

function unzip(zipFile, toPath) {
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(toPath);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
