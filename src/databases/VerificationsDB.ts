import Dexie from 'dexie'
import {
  ITables,
  Databases
} from './'

import {
  ETHEREUM_NETWORKS,
} from '../stores/EthereumStore'
import {
  IUser,
} from '../stores/UserStore'
import {
  Iverifications,
  IbindingSocials,
  IboundSocials,
} from '../stores/BoundSocialsStore'

export class VerificationsDB {
  constructor(private tables: ITables, private dexieDB: Dexie, private dataBases: Databases) {

    // unreachable code just for get rid of lint...
    if (process.env.NODE_ENV === 'foobar') {
      Object.assign({}, this.dexieDB, this.dataBases)
    }
  }

  public createVerifications({
    networkId,
    userAddress,
  }: IUser) {
    const {
      tableVerifications
    } = this.tables
    return tableVerifications
      .add(
        {
          networkId,
          userAddress,
          bindingSocials: {},
          boundSocials: {},
          lastFetchBlock: 0,
        },
      )
      .then((primaryKeys) => tableVerifications.get(primaryKeys)) as Dexie.Promise<Iverifications>
  }

  public getVerifications(networkId: ETHEREUM_NETWORKS, userAddress: string) {
    return this.tables.tableVerifications.get([networkId, userAddress])
  }

  public getVerificationsOfUser({
    networkId,
    userAddress,
  }: IUser) {
    return this.tables.tableVerifications.get([networkId, userAddress])
  }

  public updateVerifications(
    {
      networkId,
      userAddress
    }: Iverifications,
    updateVerificationsOptions: IUpdateVerificationsOptions = {}
  ) {
    const {
      tableVerifications
    } = this.tables
    return this.tables.tableVerifications
      .update(
        [networkId, userAddress],
        updateVerificationsOptions
      )
      .then(() => tableVerifications.get([networkId, userAddress])) as Dexie.Promise<Iverifications>
  }

  public deleteVerifications({
    networkId,
    userAddress
  }: Iverifications) {
    return this.tables.tableVerifications
      .delete([networkId, userAddress])
  }

  public deleteVerificationsOfUser({
    networkId,
    userAddress
  }: IUser) {
    return this.tables.tableVerifications
      .delete([networkId, userAddress])
  }
}

interface IUpdateVerificationsOptions {
  bindingSocials?: IbindingSocials
  boundSocials?: IboundSocials
  lastFetchBlock?: number
}
