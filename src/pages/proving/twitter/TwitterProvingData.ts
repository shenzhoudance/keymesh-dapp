import {
  action,
} from 'mobx'

import ProvingData from '../ProvingData'

import { ITweet, TwitterResource } from '../../../resources/twitter'
import { PLATFORMS } from '../../../stores/BoundSocialsStore'
import ENV from '../../../config'

export class TwitterProvingData extends ProvingData {
  public platform = PLATFORMS.TWITTER
  protected defaultCheckingErrorContent = 'Please tweet the text exactly as it appears, then check again!'

  private readonly twitterResource = new TwitterResource(
    ENV.TWITTER_CONSUMER_KEY,
    ENV.TWITTER_SECRET_KEY,
  )

  @action
  protected init() {
    this.steps = [
      'Fetch user info',
      'Tweet',
      'Upload infomations',
      'Done',
    ]

    if (window.location.search === '') {
      this.authorize()
    } else {
      this.fetchUserInfo()
    }
  }

  protected async getProofURL(claimText: string): Promise<string | null> {
    const tweets = await this.twitterResource.getTweets(this.username)
    return getClaimTweetURL(tweets, claimText)
  }

  private fetchUserInfo() {
    const url = ENV.TWITTER_OAUTH_CALLBACK + window.location.search
    history.pushState(null, '', window.location.href.split('?')[0])
    fetch(url)
      .then((resp) => resp.json())
      .then((body) => {
        this.updateUsername(body.screen_name)
        this.continueHandler()
      })
    // todo deal with 401
  }

  private authorize() {
    fetch(ENV.TWITTER_OAUTH_API)
      .then((resp) => resp.text())
      .then((url) => window.location.href = url)
  }
}

function getClaimTweetURL(tweets: ITweet[], claimText: string): string | null {
  for (const tweet of tweets) {
    if (tweet.full_text === claimText) {
      return `https://twitter.com/statuses/${tweet.id_str}`
    }
  }
  return null
}
