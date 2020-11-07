import { createLocalVue } from '@vue/test-utils'
import Vuex, { Store } from 'vuex'
import cloneDeep from 'lodash/cloneDeep'
import nock from 'nock'
import { advanceBy, advanceTo, clear } from 'jest-date-mock'

import { accountsModule } from '@/store/modules/accounts'
import { notificationModule } from '@/store/modules/notification'
import { IAccountsState } from '@/store/modules/accounts/types'

import tokensStub from './stubs/tokens.json'
import accountInfoStub from './stubs/accountInfo.json'
import accountStub from './stubs/defaultAccount.json'
import normalizedAccountStub from './stubs/normalizedAccount.json'

describe('accounts module', () => {
  let store: Store<{ accounts: IAccountsState }>
  let localVue
  const baseURL = 'https://api.sirus.su'

  beforeEach(() => {
    localVue = createLocalVue()
    localVue.use(Vuex)

    store = new Vuex.Store({
      modules: {
        accounts: cloneDeep(accountsModule),
        notification: cloneDeep(notificationModule),
      },
    })

    nock.cleanAll()
    clear()
  })

  test('correct account from request & setting as default', async () => {
    nock(baseURL).post('/oauth/token').reply(200, tokensStub)
    nock(baseURL).get('/api/user').reply(200, accountInfoStub)

    await store.dispatch('accounts/sendAuthRequest', {
      username: 'asddsa',
      password: 'asddsaasddsa',
    })

    expect(Object.keys(store.getters)).toContain('accounts/accounts')
    expect(Object.keys(store.getters)).toContain('accounts/defaultAccount')
    expect(store.getters['accounts/accounts']).toHaveLength(1)
    expect(store.getters['accounts/defaultAccount']).toMatchObject(accountStub)
  })

  test('validation without offset', async () => {
    nock(baseURL).post('/oauth/token').reply(401)
    advanceTo(new Date(2020, 9, 0, 0, 0, 0))

    await store.dispatch('accounts/addAccount', normalizedAccountStub)
    await store.dispatch('accounts/setValidationTimestamp')

    advanceBy(25 * 60 * 60 * 1000) // next day

    await store.dispatch('accounts/validateAccounts')
    expect(
      store.state.accounts.accounts.data.byId[normalizedAccountStub.id]
        .tokenIsExpired
    ).toBe(true)
  })

  test('validation with offset', async () => {
    advanceTo(new Date(2020, 9, 0, 0, 0, 0))

    await store.dispatch('accounts/addAccount', normalizedAccountStub)
    await store.dispatch('accounts/setValidationTimestamp')

    store.state.accounts.additional.lastValidationTimestamp.timezone =
      'Some timezone'
    const offset = -new Date().getTimezoneOffset() * 60 * 1000
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    advanceBy(offset)

    const timestamp =
      store.state.accounts.additional.lastValidationTimestamp.timestamp
    const timestampWithDelay =
      store.state.accounts.additional.lastValidationTimestamp
        .timestampWithDelayTime

    await store.dispatch('accounts/validateAccounts')
    expect(
      store.state.accounts.additional.lastValidationTimestamp.timezone
    ).toBe(timezone)
    expect(
      store.state.accounts.additional.lastValidationTimestamp.timestamp
    ).toBe(timestamp + offset)
    expect(
      store.state.accounts.additional.lastValidationTimestamp
        .timestampWithDelayTime
    ).toBe(timestampWithDelay + offset)
  })
})
