import * as React from 'react'

import * as styles from './index.css'
import { Icon } from 'antd'
import {
  Link,
} from 'react-router-dom'
import {
  SOCIALS,
  IBoundSocial,
  VERIFY_SOCIAL_STATUS,
  IVerifyStatus,
} from '../../stores/BoundSocialsStore'
import { beforeOneDay } from '../../utils/time'
import * as classnames from 'classnames'

interface IProps {
  platform: SOCIALS
  isSelf: boolean
  boundSocial: IBoundSocial
  verifyStatus: IVerifyStatus
  verify: () => Promise<void>
  isVerifying: boolean
}

export class VerifiedItem extends React.Component<IProps> {
  public componentDidMount() {
    const { lastVerifiedAt } = this.props.verifyStatus
    if (beforeOneDay(lastVerifiedAt)) {
      this.props.verify()
    }
  }

  public render() {
    const { boundSocial, verifyStatus , platform, isVerifying } = this.props
    let usernameClassName = styles.grey
    let iconColor = styles.grey
    if (!isVerifying) {
      if (verifyStatus.status === VERIFY_SOCIAL_STATUS.VALID) {
        iconColor = usernameClassName = styles.valid
      } else if (verifyStatus.status === VERIFY_SOCIAL_STATUS.INVALID) {
        iconColor = usernameClassName = styles.invalid
      }
    }
    return <li className={styles.li}>
      <div>
        <Icon type={platform} className={classnames(styles.platformIcon, iconColor)} />
        <Link to={`/proving/${platform}`} title="Click to overwrite the proof">
          <span className={usernameClassName}>{boundSocial.username}</span>
        </Link>
        <span className={styles.grey}> @{platform}</span>
      </div>
      <div>{this.renderStatus()}</div>
    </li>
  }

  private getStatusIconParams(): {
    type: string
    className: string
  } {
    const { verifyStatus, isVerifying } = this.props

    let type = ''
    let className = ''
    if (isVerifying) {
      type = 'clock-circle'
      className = styles.checking
      return {type, className}
    }

    if (verifyStatus.status === VERIFY_SOCIAL_STATUS.VALID) {
      type = 'check-circle'
      className = styles.valid
      return {type, className}
    }

    if (verifyStatus.status === VERIFY_SOCIAL_STATUS.INVALID) {
      className = styles.invalid
      type = 'cross-circle'
      return {type, className}
    }

    return {type, className}
  }

  private renderStatus() {
    const iconParams = this.getStatusIconParams()
    return <Icon
      title="Click to re-check"
      onClick={this.props.verify}
      type={iconParams.type}
      className={iconParams.className}
    />
  }
}
