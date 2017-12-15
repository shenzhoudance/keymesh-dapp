import * as web3 from 'trustbase/typings/web3.d'

import { Dexie } from 'dexie'
import {
  derived,
  keys
} from 'wire-webapp-proteus'

import {
  REGISTER_FAIL_CODE,
  SENDING_FAIL_CODE,
  NETWORKS,
  TABLES,
  GLOBAL_SETTINGS_PRIMARY_KEY,
  MESSAGE_TYPE,
  USER_STATUS,
  MESSAGE_STATUS
} from '../src/constants'

export interface IpreKeyPublicKeys {
  [preKeyId: string]: string
}

export interface IasyncProvider {
  sendAsync(payload: web3.JsonRPCRequest, callback: (e: Error, val: web3.JsonRPCResponse) => void): void
}

export interface IuploadPreKeysLifecycle extends transactionLifecycle {
  preKeysDidUpload?: () => void
  preKeysUploadDidFail?: (err: Error) => void
}

export interface IcreateAccountLifecycle {
  accountWillCreate?: () => void
  accountDidCreate?: () => void
}

export interface IcheckMessageStatusLifecycle {
  deliveryFailed?: () => void
}

export interface IcheckRegisterLifecycle extends IcreateAccountLifecycle, IuploadPreKeysLifecycle {
  checkRegisterWillStart?: (hash: string) => void
  registerDidFail?: (err: Error | null, code?: REGISTER_FAIL_CODE) => void
}

interface transactionLifecycle {
  transactionWillCreate?: () => void
  transactionDidCreate?: (transactionHash: string) => void
}

export interface IregisterLifecycle extends transactionLifecycle {
  userDidCreate?: () => void
  registerDidFail?: (err: Error | null, code?: REGISTER_FAIL_CODE) => void
}

export interface IsendingLifecycle extends transactionLifecycle {
  sendingDidComplete?: () => void
  sendingDidFail?: (err: Error | null, code?: SENDING_FAIL_CODE) => void
}

export interface IenvelopeHeader {
  senderIdentity: keys.IdentityKey
  mac: Uint8Array
  baseKey: keys.PublicKey
  sessionTag: string
  isPreKeyMessage: boolean
  messageByteLength: number
}

export interface IglobalSettings {
  provider?: string
}

export interface InetworkSettings {
  networkId: NETWORKS
  IdentitiesAddress?: string
  PreKeysAddress?: string
  MessagesAddress?: string
}

interface IuserIdentityKeys {
  networkId: NETWORKS,
  usernameHash: string,
}

export interface IregisterRecord {
  identityTransactionHash: string
  identity: string
}

export interface Iuser extends IuserIdentityKeys {
  username: string
  lastFetchBlock: web3.BlockType
  contacts: Icontact[]
  owner: string
  status: USER_STATUS
  registerRecord?: IregisterRecord
  uploadPreKeysTransactionHash?: string
  blockHash: string
}

interface Icontact {
  username: string
  usernameHash: string
  blockHash: string
}

export interface Isession extends IuserIdentityKeys {
  sessionTag: string
  lastUpdate: number
  contact: Icontact
  subject: string
  isClosed: boolean
  unreadCount: number
  summary: string
}

export interface Imessage extends IuserIdentityKeys {
  sessionTag: string
  messageType: MESSAGE_TYPE
  timestamp: number
  isFromYourself: boolean
  plainText?: string
  transactionHash?: string
  status: MESSAGE_STATUS
}

export type TableGlobalSettings = Dexie.Table<IglobalSettings, string>
export type TableNetworkSettings = Dexie.Table<InetworkSettings, NETWORKS>
export type TableUsers = Dexie.Table<Iuser, [NETWORKS, string]>
export type TableSessions = Dexie.Table<Isession, [string, string]>
export type TableMessages = Dexie.Table<Imessage, [string, number]>

export type web3BlockType = web3.BlockType

interface ItrustbaseRawMessage {
  message: string
  timestamp: string
}

interface IdecryptedTrustbaseMessage {
  decryptedPaddedMessage: Uint8Array
  senderIdentity: keys.IdentityKey
  timestamp: string
  messageByteLength: number
}

interface IrawUnppaddedMessage {
  messageType: MESSAGE_TYPE
  subject: string
  fromUsername?: string
  plainText?: string
}

interface IreceivedMessage extends IrawUnppaddedMessage {
  sessionTag: string
  timestamp: number
  blockHash?: string
}

interface IDumpedTable {
  table: string
  rows: any[]
}

interface IDumpedDatabases {
  [dbname: string]: IDumpedTable[]
}