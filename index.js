const chromium = require('chrome-aws-lambda');

exports.handler = async (event, context, callback) => {
  console.log('--------- INSTAGRAM LIKE AUTOMATOR ----------');

  let result = null;
  let browser = null;

  const like_count = 11;

  try {
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
      userDataDir: "./user_data",
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

    result = await page.title();
  } catch (error) {
    console.log('Unexpected error:', error);
    return callback(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  console.log('Success', result);
  return callback(null, result);
}

async function logIn(page) {
  const USER = process.env.ig_user
  const PASS = process.env.ig_pass

  if (!USER || !PASS) throw 'Could not get credentials'

  try {
    await page.waitForXPath("//div[text()='Log In']", { timeout: 5000 })
    console.log('Login is here')
    const inputs = await page.$x('//input')
    console.log('Inputs: ' + inputs)
    const username = inputs[0]
    await username.type(USER, {delay: 50})
    const password = inputs[1]
    await password.type(PASS, {delay: 50})
    await page.keyboard.press('Enter')
  } catch (e) {
    console.log(`Could not log in`, e)
    return process.exit(1)
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