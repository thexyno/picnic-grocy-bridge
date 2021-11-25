import {Configuration} from "./_api";
import {exit} from "process";
import {PGBConfig} from "./pgbconfig";
import {ExposedEntityNotIncludingNotEditable, ExposedEntityNotIncludingNotListable, GenericEntityInteractionsApi, Product, ShoppingLocation, SystemApi} from "./_api/api";

export interface GrocyProduct {
  name: string;
  description?: string;





}

export class GrocyConnector {
  private axiosConfig: Configuration;

  constructor(public apiKey: string, public url: string, private config: PGBConfig) {
    this.axiosConfig = new Configuration({
      apiKey: apiKey,
      basePath: url,
    });
    this.testApiKey().then(() => {
      this.initialSetup();
    });
  }
  private async initialSetup() {
    if(!this.config.data.grocyPicnicStoreId) await this.setGrocyPicnicStoreId();
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

  public async addProduct(product: Product) {}
}
