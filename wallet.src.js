import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { bsc } from '@reown/appkit/networks'

// ✅ Put your real Project ID here
const projectId = 'PA72a4ca97a6473f141fbb931c34b4df62'

const metadata = {
  name: 'ChainEsport',
  description: 'Skill-based PvP competitions. No gambling, no betting.',
  url: 'https://www.chainesport.com',
  icons: ['https://www.chainesport.com/assets/favicon.svg']
}

const networks = [bsc]

const modal = createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: { analytics: true }
})

function emit() {
  const address = modal.getAddress?.() || null
  const chainId = modal.getChainId?.() || null
  const isBsc = chainId === 56 // BNB Chain mainnet

  window.dispatchEvent(new CustomEvent('chainesport:wallet', {
    detail: { address, chainId, isBsc }
  }))
}

// Subscribe to changes
modal.subscribeProvider?.(() => emit())

// Fire once on load (handles restored sessions)
emit()

window.ChainEsportWallet = {
  open: () => modal.open(),
  openNetworks: () => modal.open({ view: 'Networks' }),
  getAddress: () => modal.getAddress?.() || null,
  getChainId: () => modal.getChainId?.() || null
}
