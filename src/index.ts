import { Command } from "commander";
import { PGBConfig } from "./pgbconfig";
import PicnicClient, { CountryCodes, ImageSizes, HttpMethods } from "picnic-api";
import {exit} from "process";
import {GrocyConnector} from "./grocy-connecor";
import {PicnicEan} from "./picnic-ean";


const program = new Command('Grocy Picnic');

program
  .option('-d, --debug', 'extra debugging')
  .option('-c, --country <country>', 'Country code (DE or NL)')
  .option('-e, --email <email>', 'picnic email')
  .option('-p, --password <password>', 'picnic password')
  .option('-u, --grocy-url <url>', 'grocy url')
  .option('-k, --picnic-auth-key <auth-key>', 'picnic auth key')
  .option('-a, --api-key <api-key>', 'grocy api key')
  .version('1.0.0');

program
  .command('login')
  .description('login in to picnic and store the auth key in datadir')
  .action(login);

program
  .command('import-basket')
  .description('import the grocy basket')
  .action(importBasket);

program
  .command('import-last-order')
  .description('import the last order')
  .action(importLastDelivery);

program
  .command('import-order <order-id>')
  .description('import the order with given id')
  .action(importDelivery);

program
  .command('scan')
  .description('connect picnic products with barcodes')
  .action(scan);

const config = new PGBConfig('./data.json');


export function debug(stringToLog: any) {
  if(program.opts().debug) console.log(`DEBUG: ${stringToLog}`);
}


async function login(): Promise<any> { // PicnicClient
  const opts = program.opts();
  let authKey = opts.authKey;
  if(!authKey) {
    authKey = config.data.authKey;
  }
  const email = opts.email;
  const password = opts.password;
  let country = opts.country;
  if(!country) {
    country = config.data.country;
  } else {
    config.patch({ country: country });
  }
  if(!country) {
    console.log("Please set a country");
    exit(3);
  }

    if (authKey) {
    debug(`auth key: ${authKey}`);
    const client = new PicnicClient({
      countryCode: country === "DE" ? CountryCodes.DE : CountryCodes.NL,
      apiVersion: 17,
      authKey: authKey,
    });
    try {
      debug(JSON.stringify(await client.getUserDetails()));
      return client;
    } catch(e) {
      debug(e);
      console.log('Trying to get a new auth key');
    }
  }
  return await loginEmailPassword(email, password, country);
}

async function loginEmailPassword(email: string, password: string, country: string): Promise<any>  { // PicnicClient
  try {
  debug('logging in with username and password');
  const client = new PicnicClient({
    countryCode: country === "DE" ? CountryCodes.DE : CountryCodes.NL,
    apiVersion: 17,
  });
  try {
  await client.login(email, password);
  } catch(e) {
    console.error(e);
    exit(8);
  }
  config.patch({ authKey: client.authKey });
  debug(JSON.stringify(await client.getUserDetails()));
  return client;
  } catch(e) {
    console.log(e);
    exit(1);
  }
}

async function importBasket() {
  const opts = program.opts();
  let picnic = await login();
  let data = await picnic.getShoppingCart();
  const grocyConn = new GrocyConnector(opts.apiKey, opts.grocyUrl, config);
  const picnicEan = new PicnicEan(config, grocyConn);
  picnicEan.addProducts(data.items);
}

async function importLastDelivery() {
  const picnic = await login();
  const deliveries = await picnic.getDeliveries(true)
  await importDelivery(deliveries[0].delivery_id);
}

async function importDelivery(deliveryId: string) {
  const opts = program.opts();
  const picnic = await login();
  const grocyConn = new GrocyConnector(opts.apiKey, opts.grocyUrl, config);
  const picnicEan = new PicnicEan(config, grocyConn);
  const delivery = await picnic.getDelivery(deliveryId)
  console.log(delivery);
  const prods = [].concat(...delivery.orders.map((order: any) => order.items));
  picnicEan.addProducts(prods);
}

async function scan() {
  const opts = program.opts();
  let country = opts.country;
  if(!country) {
    country = config.data.country;
  } else {
    config.patch({ country: country });
  }
  const grocyConn = new GrocyConnector(opts.apiKey, opts.grocyUrl, config);
  const picnicEan = new PicnicEan(config, grocyConn);
  picnicEan.scan();
}

program.parse(process.argv);
