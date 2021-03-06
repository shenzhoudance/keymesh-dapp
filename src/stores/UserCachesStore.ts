import { getDatabases } from '../databases'
import { ETHEREUM_NETWORKS, MetaMaskStore } from './MetaMaskStore'
import { UsersStore } from './UsersStore'
import { IVerifiedStatus, ISocialProof, PLATFORMS, platformNames } from './SocialProofsStore'
import { sha3, isAddress } from '../utils/cryptos'
import { isHexZeroValue } from '../utils/hex'
import ENV from '../config'

export class UserCachesStore {
  private cachedUserAvatarPromises: {
    [userAddress: string]: Promise<string>,
  } = {}
  private cachedUserIdentityPromises: {
    [userAddress: string]: Promise<IUserCachesIdentity>,
  } = {}

  public get networkID(): ETHEREUM_NETWORKS {
    return this.metaMaskStore.currentEthereumNetwork!
  }

  constructor(
    private usersStore: UsersStore,
    private metaMaskStore: MetaMaskStore,
  ) {
  }

  public async getVerifications(userAddress: string): Promise<IUserCachesVerifications> {
    const user = await this.userCachesDB.get(this.networkID, userAddress)
    if (user && user.verifications) {
      return user.verifications
    }

    return getNewVerifications()
  }

  public async setVerifications(userAddress: string, verifications: IUserCachesVerifications) {
    return this.userCachesDB.update(userAddress, this.networkID, { verifications })
  }

  public getAvatarHashByUserAddress = (userAddress: string): Promise<string> => {
    let cachedPromise = this.cachedUserAvatarPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.cachedUserAvatarPromises[userAddress] = this._getAvatarHashByUserAddress(userAddress)
    }
    return cachedPromise
  }

  public getIdentityByUserAddress = (userAddress: string): Promise<IUserCachesIdentity> => {
    let cachedPromise = this.cachedUserIdentityPromises[userAddress]
    if (!cachedPromise) {
      cachedPromise = this.cachedUserIdentityPromises[userAddress] = this._getIdentityByUserAddress(userAddress)
    }
    return cachedPromise
  }

  public _getIdentityByUserAddress = async (userAddress: string): Promise<IUserCachesIdentity> => {
    const user = await this.userCachesDB.get(this.networkID, userAddress)
    if (user && user.identity) {
      return user.identity
    }

    const userIdentity = await this.usersStore.getIdentityByUserAddress(userAddress)
    if (isHexZeroValue(userIdentity.publicKey)) {
      throw new Error('cannot find user')
    }
    const identity = {
      publicKey: userIdentity.publicKey,
      blockNumber: userIdentity.blockNumber,
      blockHash: await this.metaMaskStore.getBlockHash(userIdentity.blockNumber),
    }
    if (!user) {
      const _newUser = await this.userCachesDB.create({
        userAddress,
        networkId: this.networkID,
        identity,
      })

      return _newUser.identity!
    }

    const newUser = await this.userCachesDB.update(userAddress, this.networkID, { identity })
    return newUser.identity!
  }

  private async _getAvatarHashByUserAddress(userAddress: string) {
    const identity = await this.getIdentityByUserAddress(userAddress)
    return sha3(`${userAddress}${identity.blockHash}`)
  }

  private get userCachesDB() {
    return getDatabases().userCachesDB
  }
}

export function getNewVerifications() {
  const verifications = {}
  for (const platform of platformNames) {
    verifications[platform] = {}
  }
  return verifications as IUserCachesVerifications
}

export async function searchUserInfos(networkID: ETHEREUM_NETWORKS, prefix: string): Promise<IProcessedUserInfo[]> {
  const response = await fetch(
    `${ENV.SEARCH_USERS_API}?networkID=${networkID}&usernamePrefix=${encodeURIComponent(prefix)}`,
  )
  const rawData = await response.json()
  return processUserInfo(rawData)
}

export const cachedUserInfo: ICachedUserInfo = {}

// FIXME: refactor
interface ICachedUserInfo {
  [userAddressOrUsername: string]: {
    promi: Promise<IProcessedUserInfo[]>,
    lastUpdate: number,
  },
}

export async function getUserInfos(
  networkID: ETHEREUM_NETWORKS,
  userAddressOrUsername: string,
) {
  const cache = cachedUserInfo[userAddressOrUsername]
  if (cache && Date.now() - cache.lastUpdate < 5 * 60 * 1000) {
    return cache.promi
  }

  const isUserAddress = isAddress(userAddressOrUsername)
  const query = `?networkID=${networkID}&${isUserAddress ? 'userAddress' : 'username'}=${userAddressOrUsername}`

  const fetchInfosPromise = fetchUserInfos(query)
  cachedUserInfo[userAddressOrUsername] = {
    promi: fetchInfosPromise,
    lastUpdate: Date.now(),
  }

  return fetchInfosPromise
}

export async function getUserInfoByAddress(
  networkID: ETHEREUM_NETWORKS,
  userAddress: string,
): Promise<IProcessedUserInfo | undefined> {
  const infos = await getUserInfos(networkID, userAddress)
  if (infos.length === 0) {
    return
  }

  return infos[0]
}

export function getUserInfosByUsername(
  networkID: ETHEREUM_NETWORKS,
  username: string,
): Promise<IProcessedUserInfo[]> {
  return getUserInfos(networkID, username)
}

async function fetchUserInfos(query: string): Promise<IProcessedUserInfo[]> {
  const response = await fetch(`${ENV.GET_USERS_API}${query}`)
  const rawData = await response.json()
  const infos = processUserInfo(rawData)
  return infos
}

// TODO: cache processed user info
function processUserInfo(data: IUserInfo[]): IProcessedUserInfo[] {
  const userMapping: {[userAddress: string]: IProcessedUserInfo} = {}
  const result: IProcessedUserInfo[] = []
  for (const userInfo of data) {
    const {
      userAddress,
      username,
      platformName,
      twitterOAuthInfo,
    } = userInfo
    let processedUserInfo = userMapping[userInfo.userAddress]
    if (processedUserInfo == null) {
      processedUserInfo = {
        userAddress,
        verifications: [],
      }
      result.push(processedUserInfo)
    }

    if (processedUserInfo.displayUsername == null) {
      processedUserInfo.displayUsername = username
    }

    if (processedUserInfo.description == null) {
      if (platformName === 'twitter') {
        const { description, name } = twitterOAuthInfo!
        if (description !== '') {
          processedUserInfo.description = description
        }

        if (name !== '') {
          processedUserInfo.displayUsername = name
        }
      }

      if (platformName === 'facebook') {
        // TODO
      }
    }

    processedUserInfo.verifications.push({
      platformName,
      username,
      info: platformName === 'twitter' ? twitterOAuthInfo : undefined,
    })

    if (processedUserInfo.avatarImgURL == null) {
      if (platformName === 'twitter') {
        const imgUrl = getTwitterProfileImgURL(twitterOAuthInfo!)
        if (imgUrl != null) {
          processedUserInfo.avatarImgURL = imgUrl
        }
      }

      if (platformName === 'facebook') {
        // TODO
      }
    }
  }

  return result
}

export function getTwitterProfileImgURL(twitterOAuthInfo: ITwitterOAuth): string | undefined {
  const { profile_image_url_https } = twitterOAuthInfo
  if (profile_image_url_https.includes('default_profile_images')) {
    return
  }

  return profile_image_url_https
}

interface ITwitterOAuth {
  description: string
  profile_image_url_https: string
  friends_count: number
  followers_count: number
  name: string
}

export interface IUserInfo {
  userAddress: string
  username: string
  platformName: string
  proofURL: string
  twitterOAuthInfo?: ITwitterOAuth
  gravatarHash?: string
}

export interface IProcessedUserInfo {
  userAddress: string
  verifications: IUserInfoVerications[]
  displayUsername?: string
  description?: string
  avatarImgURL?: string
}

export interface IUserInfoVerications {
  platformName: string
  username: string
  info?: ITwitterOAuth,
}

export interface IUserCachesIdentity {
  blockHash: string
  publicKey: string
  blockNumber: number
}

export interface IUserCachesVerification {
  socialProof?: ISocialProof
  lastFetchBlock?: number
  verifiedStatus?: IVerifiedStatus
}

export type IUserCachesVerifications = {
  [platformName in PLATFORMS]: IUserCachesVerification
}

export interface IUserCaches {
  networkId: ETHEREUM_NETWORKS
  userAddress: string
  identity?: IUserCachesIdentity
  verifications?: IUserCachesVerifications
}
