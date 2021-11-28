import { GrocyConnector } from './grocy-connecor';
import { PGBConfig } from './pgbconfig';
import * as readline from 'readline';
import { exit } from 'process';

export class PicnicEan {
  constructor(private config: PGBConfig, private grocy: GrocyConnector) {}

  public async addProducts(products: any[]) {
    console.debug('addProducts');
    const pidEan = this.config.data.picnicIdToEanLocation ?? new Map();
    let unknowns = this.config.data.unknownProducts ?? [];
    let unknownProductsCount = 0;
    await Promise.all(
      [].concat(...products.map((product) => product.items)).map((article: any) => {
        if (!article) {
          // seemingly some articles are empty
          return Promise.resolve();
        }
        const quantity = article.decorators.find(
          (d: any) => d.type === 'QUANTITY',
        ).quantity;
        if (pidEan[article.id]) {
          const eanLoc = pidEan[article.id];
          return this.grocy.addProduct(
            eanLoc.ean,
            quantity,
            eanLoc.location,
            article.price,
          );
        } else {
          unknownProductsCount++;
          let unkn = unknowns.find((unk) => unk.picnicId === article.id);
          if (unkn) {
            unkn = Object.assign({}, unkn);
            unkn.count += quantity;
            unknowns = unknowns
              .filter((u) => u.picnicId !== unkn!.picnicId)
              .concat([unkn]);
          } else {
            unknowns.push({
              picnicId: article.id,
              name: article.name,
              count: quantity,
            });
          }
          return Promise.resolve();
        }
      }),
    );
    console.debug(unknowns);
    this.config.patch({ unknownProducts: unknowns });
    console.debug('patched config');
  }
  public scan(ask: boolean = false) {
    // instantiate a readline
    const cli = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n> ',
    });
    const products = this.config.data.unknownProducts!;
    if(!this.config.data.unknownProducts || this.config.data.unknownProducts!.length === 0) {
      console.log('no unknown products');
      exit(0);
    }
    let mode = 'scan';
    let product = products.pop();
    let ean = '';
    if (!ask) console.log(`Please scan '${product!.name}'`);
    cli.on('line', (line) => {
      const input = line.trim();
      if(!product) exit(0);
      const prod = product!;
      if (mode === 'scan') {
        ean = input;
        mode = 'location';
        console.log(`Please enter a grocy location id`);
      } else if (mode === 'location') {
        const location = Number.parseInt(input)
        this.grocy.addProduct(ean, prod.count, location );
        
        const map = this.config.data.picnicIdToEanLocation ?? {};
        map[prod.picnicId] = {ean: ean, location: location};
        product = products.pop();
        if(!product) exit(0);
        this.config.patch({ picnicIdToEanLocation: map, unknownProducts: products });
        mode = 'scan';
        console.log(`Please scan '${product!.name}'`);
      }
    });
  }
}
