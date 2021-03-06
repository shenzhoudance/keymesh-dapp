import * as React from 'react'
import { RouteComponentProps, withRouter } from 'react-router'

// component
import { List, Button, Icon } from 'antd'
import Session from '../Session'
import NewConversationDialog from '../NewConversationDialog'
import Dialog from '../Dialog'

// style
import * as styles from './index.css'
import classnames from 'classnames'

// state management
import { observer } from 'mobx-react'
import { UserStore, IUser } from '../../../stores/UserStore'
import { ISession } from '../../../databases/SessionsDB'

import * as queryString from 'query-string'
import { isAddress } from '../../../utils/cryptos'
import { storeLogger } from '../../../utils/loggers'
import Loading from '../Loading'

@observer
class ChatContent extends React.Component<IProps, IState> {
  public readonly state = defaultState

  private isUnmounted = false
  public componentWillUnmount() {
    this.isUnmounted = true
    // clear sessions and message caches
    this.props.userStore.sessionsStore.disposeStore()
  }

  public async componentWillMount() {
    const search = this.props.location.search
    const { to, createNew }: IQuery = queryString.parse(search)
    if (createNew) {
      return
    }

    if (to != null) {
      // try to create conversation through url
      try {
        this.setState({
          isTryingToCreateConversation: true,
        })
        await this.tryCreateNewConversation(to)
        return
      } catch (err) {
        this.setNewConversationQuery(true)
        storeLogger.error(
          `Failed to create new session with ${to}:`,
          err,
        )
        return
      } finally {
        if (!this.isUnmounted) {
          this.setState({
            isTryingToCreateConversation: false,
          })
        }
      }
    }

    const { sessionsStore } = this.props.userStore
    const { currentSessionStore } = sessionsStore
    if (currentSessionStore != null) {
      this.handleSelectSession(currentSessionStore.session)
      return
    }

    await sessionsStore.waitForSessions()
    const { sessions } = sessionsStore
    if (sessions.length > 0) {
      this.handleSelectSession(sessions[0])
      return
    }

    this.setNewConversationQuery(true)
  }

  public render() {
    const { user, sessionsStore } = this.props.userStore
    const { currentSessionStore, isLoadingSessions } = sessionsStore

    const { isTryingToCreateConversation } = this.state
    if (isLoadingSessions || isTryingToCreateConversation) {
      return <Loading message="Loading data..." />
    }

    return (
      <div className={classnames(styles.content, 'fullscreen-container')}>
        <div className={styles.sessionList}>
          <div className={styles.sessionListTopBar}>
            <Button
              disabled={!sessionsStore.hasSelectedSession}
              onClick={this.handleNewConversationClick}
              className={styles.newConversationButton}
              size="small"
              type="primary"
            >
              New Conversation {' '} <Icon type="plus" />
            </Button>
          </div>
          <List
            className={styles.sessionListInner}
            dataSource={sessionsStore.sessions}
            renderItem={(session: ISession) => (
              <Session
                className={classnames({
                  [styles.selectedSession]: sessionsStore.isCurrentSession(
                    session.sessionTag,
                  ),
                })}
                key={session.sessionTag}
                sessionStore={sessionsStore.getSessionStore(session)}
                onClick={this.handleSelectSession}
              />
            )}
            // Here is a hack, since antd does not provide renderEmpty prop
            // you can actually put any JSX.Element into emptyText
            locale={{ emptyText: (
              <div className={classnames(styles.emptyInbox, 'center-align-column-container')}>
                <Icon className={styles.inboxIcon} type="inbox" />
                Empty inbox
              </div>
            )}}
          />
        </div>
        {currentSessionStore != null ? (
          <Dialog sessionStore={currentSessionStore} />
        ) : (
          <NewConversationDialog
            tryCreateNewConversation = {this.tryCreateNewConversation.bind(this)}
            sessionsStore={sessionsStore}
            user={user}
          />
        )}
      </div>
    )
  }

  private async tryCreateNewConversation(userAddress: string, skipCheck = false) {
    const { userStore } = this.props
    const { sessionsStore } = userStore

    sessionsStore.unselectSession()
    await sessionsStore.waitForSessions()

    const oldSessions = sessionsStore.getSessionByReceiver(userAddress)
    if (oldSessions.length > 0) {
      await this.handleSelectSession(oldSessions[0])
      return
    }

    if (!skipCheck) {
      await this.validReceiverUserAddress(userAddress, userStore.user)
    }

    const session = sessionsStore.createNewConversation(userAddress)
    sessionsStore.addSession(session)
    this.handleSelectSession(session)
  }

  // private async trySelectSession(id: string) {
  //   const { sessionsStore } = this.props.userStore
  //   sessionsStore.unselectSession()
  //   await sessionsStore.waitForSessions()
  //   const session = sessionsStore.getSession(id)

  //   if (session == null) {
  //     this.setNewConversationQuery()
  //     return
  //   }

  //   this.handleSelectSession(session)
  // }

  private validReceiverUserAddress = async (
    userAddress: string,
    currentUser: IUser,
  ) => {
    if (userAddress === '') {
      throw new Error('Empty address')
    }

    if (userAddress === currentUser.userAddress) {
      throw new Error(`Can't send message to yourself!`)
    }

    if (!isAddress(userAddress)) {
      throw new Error('Invalid Ethereum address!')
    }

    try {
      // check receiver's public key and pre-keys package
      await this.props.userStore.sessionsStore.validateReceiver(userAddress)
    } catch (err) {
      throw new Error('User had not registered with KeyMesh')
    }
  }

  private handleSelectSession = async (session: ISession) => {
    const { sessionsStore } = this.props.userStore
    if (sessionsStore.isCurrentSession(session.sessionTag)) {
      return
    }

    this.setNewConversationQuery(undefined)

    sessionsStore.selectSession(session)
  }

  private handleNewConversationClick = () => {
    this.setNewConversationQuery(true)

    this.props.userStore.sessionsStore.unselectSession()
  }

  private setNewConversationQuery = (value: boolean | undefined) => {
    this.props.history.replace({
      search: queryString.stringify({ createNew: value }),
    })
  }
}

interface IProps extends RouteComponentProps<{}> {
  userStore: UserStore
}

interface IState {
  isTryingToCreateConversation: boolean
}

const defaultState: Readonly<IState> = {
  isTryingToCreateConversation: false,
}

interface IQuery {
  to?: string
  createNew?: boolean
}

export default withRouter(ChatContent)
