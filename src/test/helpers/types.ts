export interface Account {
  idp: string
  podUrl: string
  webId: string
  username: string
  password: string
  email: string
  fetch: typeof globalThis.fetch
}

interface Pod {
  publicTypeIndex: string
}

interface Accommodation {
  uri: string
  lat: number
  long: number
}

interface Hospex {
  personalHospexDocument: string
  hospexContainer: string
  accommodations: Accommodation[]
}

export interface Person {
  account: Account
  pod: Pod
  hospex: Hospex
}
