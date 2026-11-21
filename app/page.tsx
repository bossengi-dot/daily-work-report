'use client'

import App from '../src/App'
import { StoreProvider } from '../src/store'

export default function HomePage() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  )
}
