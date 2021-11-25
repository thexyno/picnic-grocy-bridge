import { Command } from "commander";
import { PGBConfig } from "./pgbconfig";
import PicnicClient, { CountryCodes, ImageSizes, HttpMethods } from "picnic-api";
import {exit} from "process";


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
  .action(importLastOrder);

program
  .command('import-order <order-id>')
  .description('import the order with given id')
  .action(importOrder);

program
  .command('barcode-connect')
  .description('connect created grocy products with barcodes')
  .action(barcodeConnect);

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
  const country = opts.country;
  const url = country == "DE" ? "https://storefront-prod.de.picnicinternational.com/api/17" : "https://storefront-prod.nl.picnicinternational.com/api/17"
  if (authKey) {
    debug(`auth key: ${authKey}`);
    const client = new PicnicClient({
      countryCode: country === "DE" ? CountryCodes.DE : CountryCodes.NL,
      apiVersion: 17,
      authKey: authKey,
      url: url,
    });
    try {
      debug(JSON.stringify(await client.getUserDetails()));
      return client;
    } catch(e) {
      debug(e);
      console.log('Trying to get a new auth key');
    }
  }
  return await loginEmailPassword(email, password, country, url);
}

async function loginEmailPassword(email: string, password: string, country: string, url: string): Promise<any>  { // PicnicClient
  try {
  const client = new PicnicClient({
    countryCode: country === "DE" ? CountryCodes.DE : CountryCodes.NL,
    apiVersion: 17,
    url: url,
  });
  await client.login(email, password);
  config.patch({ authKey: client.authKey });
  debug(JSON.stringify(await client.getUserDetails()));
  } catch(e) {
    console.log(e);
    exit(1);
  }
}

function importBasket() {
  throw new Error("Function not implemented.");
}

function importLastOrder() {
  throw new Error("Function not implemented.");
}

function importOrder(orderId: string) {
  throw new Error("Function not implemented.");
}

function barcodeConnect(barcodeConnect: any) {
  throw new Error("Function not implemented.");
}

program.parse(process.argv);
