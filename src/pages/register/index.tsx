import * as React from 'react'
import { RouteComponentProps } from 'react-router-dom'

import securedAccountImg from './secured-account.svg'

// component
import {
  Divider,
  Modal,
  Alert,
} from 'antd'
import UserAddress from '../../components/UserAddress'
import StatusButton, { STATUS_TYPE } from '../../components/StatusButton'
import AccountRegisterStatus, { REGISTER_STATUS } from '../../components/AccountRegisterStatus'
import TransactionStatus, { TRANSACTION_STATUS } from '../../components/TransactionStatus'
import RestoreUserButton from '../../components/RestoreUserButton'

// style
import * as classes from './index.css'
import composeClass from 'classnames'

// state management
import { Lambda } from 'mobx'
import { inject, observer } from 'mobx-react'
import { IStores } from '../../stores'
import { MetaMaskStore } from '../../stores/MetaMaskStore'
import { UsersStore } from '../../stores/UsersStore'
import { UserStore, USER_STATUS } from '../../stores/UserStore'

// helper
import { sleep } from '../../utils'

@inject(mapStoreToProps)
@observer
class Register extends React.Component<IProps, IState> {
  public readonly state = defaultState

  private readonly injectedProps = this.props as Readonly<IInjectedProps & IProps>
  private disposeWalletAccountReaction: Lambda | undefined
  private retryCheckStatus: (() => void) | undefined
  private isUnmounted = false

  private get isCreatingTransaction() {
    return this.state.transactionCreationStatus === TRANSACTION_CREATION_STATUS.PENDING
  }

  public componentDidMount() {
    const { metaMaskStore } = this.injectedProps
    // reset state when wallet account have changed
    this.disposeWalletAccountReaction = metaMaskStore.listenForWalletAccountChange(this.resetState)
  }

  public componentWillUnmount() {
    this.isUnmounted = true

    const { disposeWalletAccountReaction } = this
    if (disposeWalletAccountReaction) {
      disposeWalletAccountReaction()
    }
  }

  public render() {
    const { metaMaskStore } = this.injectedProps
    const { isActive } = metaMaskStore
    if (!isActive) {
      return null
    }
    const { walletAddress } = metaMaskStore

    return (
      <div className="page-container">
        <Alert
          className={classes.ethPrompt}
          closable={true}
          message={<h3>Do you need some Rinkeby test tokens?</h3>}
          description={
            <>
              <p>
                The KeyMesh BETA runs on the Rinkeby Test Network, so you can’t use real $ETH to pay for transactions.
              </p>
              <p>
                You can get free tokens from {' '}
                <a href="https://faucet.rinkeby.io" target="_blank">
                  https://faucet.rinkeby.io
                </a>
              </p>
            </>
          }
          type="info"
        />
        <section className={composeClass(classes.signupSection, 'block')}>
          <h2 className="title">
            Power Up Your Ethereum Address
          </h2>
          <img className={classes.securedAccountImg} src={securedAccountImg} />
          <p className="description">
            You will create a new cryptographic identity for secure communication, and publish it on the blockchain
          </p>
          <h3>Your Ethereum Address</h3>
          <UserAddress className={classes.userAddress} userAddress={walletAddress} />
          {this.renderRegisterStatusButton()}
          <Divider />
          <RestoreUserButton />
        </section>
      </div>
    )
  }

  private renderRegisterStatusButton() {
    const { usersStore } = this.injectedProps
    const {
      hasRegisterRecordOnLocal,
      hasRegisterRecordOnChain,
      walletCorrespondingUserStore,
    } = usersStore

    const { isCheckingRegisterRecord } = usersStore
    const canTakeover = !hasRegisterRecordOnLocal && hasRegisterRecordOnChain
    const handleClick = canTakeover ? this.handleConfirmTakeOver : this.handleRegister

    const shouldDisableButton = isCheckingRegisterRecord || hasRegisterRecordOnLocal || this.isCreatingTransaction

    const { type, content, help } = this.getStatusContent(
      hasRegisterRecordOnLocal,
      hasRegisterRecordOnChain,
      isCheckingRegisterRecord,
      walletCorrespondingUserStore,
    )

    return (
      <StatusButton
        buttonClassName={classes.registerButton}
        disabled={shouldDisableButton}
        statusType={type}
        statusContent={content}
        helpContent={help}
        onClick={handleClick}
      >
        Sign Up With MetaMask
      </StatusButton>
    )
  }

  private getStatusContent(
    hasRegisterRecordOnLocal: boolean,
    hasRegisterRecordOnChain: boolean,
    isCheckingRegisterRecord: boolean,
    walletCorrespondingUserStore?: UserStore,
  ): {
    type?: STATUS_TYPE,
    content?: React.ReactNode,
    help?: React.ReactNode,
  } {
    if (isCheckingRegisterRecord) {
      const type = STATUS_TYPE.LOADING
      const content = 'Checking...'
      const help = 'Checking if address is registered'
      return { type, content, help }
    }

    if (
      walletCorrespondingUserStore != null
      && walletCorrespondingUserStore.user.status === USER_STATUS.OK
    ) {
      const type = STATUS_TYPE.SUCCESS

      let content: React.ReactNode = 'Registered'
      if (!walletCorrespondingUserStore.isUsing) {
        content = (
          <>
            {content}
            <a
              className={classes.statusButtonAction}
              onClick={() => walletCorrespondingUserStore.useUser()}
            >
              Sign In
            </a>
          </>
        )
      }

      const help = 'You can still register new account using other Ethereum address'

      return { type, content, help }
    }
    const { state } = this
    const { transactionCreationStatus } = state

    if (transactionCreationStatus != null) {
      const status = getTransactionStatus(transactionCreationStatus)
      const { metaMaskStore } = this.injectedProps
      const { networkID } = metaMaskStore
      return {
        type: TRANSACTION_CREATION_ICON_TYPES[transactionCreationStatus],
        content: (
          <TransactionStatus
            status={status}
            networkId={networkID}
          />
        ),
      }
    }

    if (
      !hasRegisterRecordOnLocal &&
      hasRegisterRecordOnChain
    ) {
      const type = STATUS_TYPE.WARN
      const content = 'Registered on another device'
      const help = 'You can register anyway, or restore the account backup from your other device'

      return { type, content, help }
    }

    const { registerStatus } = state
    const statusType = registerStatus == null ? undefined : REGISTER_STATUS_ICON_TYPES[registerStatus]

    if (walletCorrespondingUserStore != null) {
      const canRetry = (
        registerStatus === REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED ||
        registerStatus === REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR
      )
      const retryButton = (
        <a
          role="button"
          className={classes.statusButtonAction}
          onClick={this.retryCheckStatus}
        >
          Retry
        </a>
      )

      const content = (
        <>
          <AccountRegisterStatus
            key={walletCorrespondingUserStore.user.userAddress}
            userStore={walletCorrespondingUserStore}
            getRetry={this.getCheckStatusRetry}
            onStatusChanged={this.handleRegisterStatusChanged}
            onRegisterCompleted={this.handleRegisterCompleted}
          />
          {
            canRetry
              ? retryButton
              : null
          }
        </>
      )

      return { type: statusType, content }
    }

    return { type: statusType }
  }

  private getCheckStatusRetry = (retry: () => void) => {
    this.retryCheckStatus = retry
  }

  private handleRegisterStatusChanged = (status: REGISTER_STATUS) => {
    if (this.isUnmounted) {
      return
    }

    this.setState({
      registerStatus: status,
    })
  }

  private handleRegisterCompleted = async () => {
    if (this.isUnmounted) {
      return
    }

    const { usersStore } = this.injectedProps
    const { users } = usersStore

    await usersStore.useUser(users[users.length - 1])

    if (users.length === 1) {
      this.props.history.push('/getting-started')
    }
  }

  private handleRegister = async () => {
    this.setState({ transactionCreationStatus: TRANSACTION_CREATION_STATUS.PENDING })

    try {
      await this.injectedProps.usersStore.register()
      this.handleTransactionCreated()
    } catch (err) {
      this.handleTransactionFailed(err)
    }
  }

  private handleConfirmTakeOver = () => {
    Modal.confirm({
      iconType: 'warning',
      content: 'If you take over this address, your account on the other device will stop working.',
      okText: 'Take Over',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: this.handleRegister,
    })
  }

  private handleTransactionCreated = async () => {
    await sleep(300)
    if (this.isUnmounted) {
      return
    }

    this.setState({
      transactionCreationStatus: undefined,
    })
  }

  private handleTransactionFailed = (err: Error) => {
    if (this.isUnmounted) {
      return
    }

    if (err.message.includes('User denied transaction signature')) {
      this.setState({
        transactionCreationStatus: TRANSACTION_CREATION_STATUS.REJECTED,
      })
      return
    }

    this.setState({
      transactionCreationStatus: TRANSACTION_CREATION_STATUS.FAILED,
    })
  }

  private resetState = () => {
    this.setState(defaultState)
  }
}

function mapStoreToProps({
  metaMaskStore,
  usersStore,
}: IStores) {
  return {
    metaMaskStore,
    usersStore,
  }
}

enum TRANSACTION_CREATION_STATUS {
  PENDING,
  REJECTED,
  FAILED,
}

function getTransactionStatus(creationStatus: TRANSACTION_CREATION_STATUS): TRANSACTION_STATUS {
  switch (creationStatus) {
    case TRANSACTION_CREATION_STATUS.PENDING:
      return TRANSACTION_STATUS.PENDING
    case TRANSACTION_CREATION_STATUS.REJECTED:
      return TRANSACTION_STATUS.REJECTED
    case TRANSACTION_CREATION_STATUS.FAILED:
    default:
      return TRANSACTION_STATUS.UNEXCEPTED_ERROR
  }
}

const TRANSACTION_CREATION_ICON_TYPES = Object.freeze({
  [TRANSACTION_CREATION_STATUS.PENDING]: STATUS_TYPE.LOADING,
  [TRANSACTION_CREATION_STATUS.REJECTED]: STATUS_TYPE.WARN,
  [TRANSACTION_CREATION_STATUS.FAILED]: STATUS_TYPE.ERROR,
})

const REGISTER_STATUS_ICON_TYPES = Object.freeze({
  [REGISTER_STATUS.IDENTITY_UPLOADING]: STATUS_TYPE.LOADING,
  [REGISTER_STATUS.PRE_KEYS_UPLOADING]: STATUS_TYPE.LOADING,
  [REGISTER_STATUS.SUCCESS]: STATUS_TYPE.SUCCESS,
  [REGISTER_STATUS.CHECK_IDENTITY_TIMEOUT]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.UNEXCEPTED_IDENTITY_UPLOAD_ERROR]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.PRE_KEYS_UPLOAD_FAILED]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.TAKEOVERED]: STATUS_TYPE.WARN,
  [REGISTER_STATUS.IDENTITY_UPLOAD_TRANSACTION_ERROR]: STATUS_TYPE.ERROR,
})

// typing
interface IProps extends RouteComponentProps<{}> { }

const defaultState: Readonly<IState> = {
  transactionCreationStatus: undefined,
  transactionHash: undefined,
  registerStatus: undefined,
}

interface IInjectedProps {
  metaMaskStore: MetaMaskStore
  usersStore: UsersStore
}

interface IState {
  transactionCreationStatus?: TRANSACTION_CREATION_STATUS
  transactionHash?: string
  registerStatus?: REGISTER_STATUS
}

export default Register
