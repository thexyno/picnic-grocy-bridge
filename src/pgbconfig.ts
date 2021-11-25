import * as fs from 'fs';

export interface PGBridge {
  authKey?: string;
  grocyPicnicStoreId?: number;
}

export class PGBConfig {
  private pgbData: PGBridge;
  public get data() {
    return this.pgbData;
  }
  public write(data: PGBridge) {
    this.pgbData = data;
    fs.writeFileSync(this.filePath, JSON.stringify(this.pgbData), 'utf8');
  }
  public patch(...data: Partial<PGBridge>[]) {
    this.write(Object.assign(this.pgbData, ...data));
  }

  constructor(public filePath: string) {
    this.filePath = filePath;
    if(!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '{}', 'utf8');
    }
    this.pgbData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}
