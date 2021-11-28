import * as fs from 'fs';
import * as util from 'util';
import {Configuration} from "./_api";
import {exit} from "process";
import {PGBConfig} from "./pgbconfig";
import {ExposedEntityNotIncludingNotEditable, ExposedEntityNotIncludingNotListable, GenericEntityInteractionsApi, Product, QuantityUnit, ShoppingLocation, StockByBarcodeApi, StockTransactionType, SystemApi} from "./_api/api";
import axios from "axios";

const readFile = util.promisify(fs.readFile);
const exists = util.promisify(fs.exists);

export class GrocyConnector {
  private axiosConfig: Configuration;

  constructor(public apiKey: string, public url: string, private config: PGBConfig) {
    if(!url) {
      console.error("no grocy url provided");
      exit(9);
    }
    this.axiosConfig = new Configuration({
      apiKey: apiKey,
      basePath: url,
    });
    this.testApiKey().then(() => {
      this.initialSetup().catch(err => {
        console.error('initial grocy setup failed');
        console.error(err);
        exit(3);
      });
    });
  }
  private async initialSetup() {
    if(!this.config.data.grocyPicnicStoreId) await this.setGrocyPicnicStoreId();
    if(!this.config.data.grocyQuantityUnits) await this.setupGrocyQuantityUnits();
  }
  private async setupGrocyQuantityUnits() {
    const gei = new GenericEntityInteractionsApi(this.axiosConfig);
    const filePath = 'grocy-units-default.json';
    if(!await exists(filePath)) {
      throw new Error(`Default grocy units file (${filePath}) does not exist`);
    }
    const defaultQuantityUnits: {name: string; name_plural: string; description: string}[] = JSON.parse(await readFile(filePath, 'utf8'));
    const existingGrocyQuantityUnits = (await gei.objectsEntityGet(ExposedEntityNotIncludingNotListable.QuantityUnits)).data as QuantityUnit[]
    for(let qu of defaultQuantityUnits) {
      if(!existingGrocyQuantityUnits.find(gqu => gqu.name!.toLowerCase() === qu.name!.toLowerCase())) {
        await gei.objectsEntityPost(ExposedEntityNotIncludingNotEditable.QuantityUnits, qu);
      }
    }
    const allQuantityUnits = (await gei.objectsEntityGet(ExposedEntityNotIncludingNotListable.QuantityUnits)).data as QuantityUnit[]
    this.config.patch({ grocyQuantityUnits: allQuantityUnits });
  }
  private async setGrocyPicnicStoreId() {
    const gei = new GenericEntityInteractionsApi(this.axiosConfig);
    const stores: ShoppingLocation[] = (await gei.objectsEntityGet(ExposedEntityNotIncludingNotListable.ShoppingLocations)).data as ShoppingLocation[];

    const filteredStores = stores.filter(store => store.name === "Picnic");
    if(filteredStores.length === 0) {
      const req = (await gei.objectsEntityPost(ExposedEntityNotIncludingNotEditable.ShoppingLocations, { name: "Picnic" })).data;
      this.config.write({ grocyPicnicStoreId: req.created_object_id });
    } else {
      this.config.write({ grocyPicnicStoreId: filteredStores[0].id });
    }
  }

  private async testApiKey() {
    try {
      return await new SystemApi(this.axiosConfig).systemInfoGet();
    } catch (reason) {
      console.log(reason);
      exit(2);
    }
  }

  private getQuantityUnit(packaging: string): number {
    const packages = packaging.split(',');
    for(let pack of packages) {
      const grocyQuantityUnit = (this.config.data.grocyQuantityUnits ?? []).find(gqu => gqu.name!.toLowerCase() === pack.toLowerCase()) ?? null;
      if(grocyQuantityUnit){
        return grocyQuantityUnit.id!;
      }
    }
    throw new Error(`none of ${packaging} are valid quantity units`);
  }

  public async addProduct(ean: string, count = 1, location_id: number, price?: number): Promise<void> {
    const country = this.config.data.country!.toLowerCase();
    const sbba = new StockByBarcodeApi(this.axiosConfig)
    try {
    await sbba.stockProductsByBarcodeBarcodeGet(ean)
    } catch (reason: any) {
      console.debug(reason.data);
      console.debug('product does not exist in grocy, creating');
      // assuming product does not exist

      // getting data from openfoodfacts
      try {
      const gei = new GenericEntityInteractionsApi(this.axiosConfig);
      const off = await axios.get(`https://${country}.openfoodfacts.org/api/v0/product/${ean}.json`, { headers: {'User-Agent': 'picnic-grocy-connector - Linux - Version 0.0.1 - https://github.com/ragon000/picnic-grocy-bridge' }});
      const offProduct = off.data.product;
      let quantityUnitId: number;
      try {
        quantityUnitId = this.getQuantityUnit(offProduct.packaging);
      } catch (error: any) {
        console.warn(error);
        console.warn('defaulting to Packung assuming it exists');
        quantityUnitId = this.getQuantityUnit('Packung');
      }
      let name = !!offProduct[`product_name_${country}`] ? offProduct[`product_name_${country}`] : offProduct[`product_name`]
      const objid = (await gei.objectsEntityPost(ExposedEntityNotIncludingNotEditable.Products, {
        name: `${offProduct['brands']} ${name}`,
        description: !!offProduct[`generic_name_${country}`] ? offProduct[`generic_name_${country}`] : offProduct[`generic_name`],
        default_best_before_days: -1, // off does not seem to have this information
        qu_factor_purchase_to_stock: 1,
        qu_id_purchase: quantityUnitId,
        qu_id_stock: quantityUnitId,
        shopping_location_id: this.config.data.grocyPicnicStoreId,
        location_id: location_id,
      })).data.created_object_id;
      await gei.objectsEntityPost(ExposedEntityNotIncludingNotEditable.ProductBarcodes, {
        product_id: objid,
        barcode: ean,
      });
      } catch (error) {
        console.log(error);
        // todo add a handler for products not in off
      }
    } finally {
      await sbba.stockProductsByBarcodeBarcodeAddPost(ean, {amount: count, price: price, transaction_type: StockTransactionType.Purchase, location_id: location_id });
    }
  }
}
