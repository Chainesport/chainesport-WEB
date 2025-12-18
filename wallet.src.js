import { createAppKit } from '@reown/appkit'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

// ✅ Put your real Project ID here (NO "PA" prefix)
const projectId = 'e134945e9044b282d52eada3841fc6f2'

// ✅ MUST match the real site origin
const metadata = {
  name: 'ChainEsport',
  description: 'Skill-based PvP competitions. No gambling, no betting.',
  url: 'https://www.chainesport.com',
  icons: ['https://www.chainesport.com/assets/social_hero.png']
}

// ✅ Custom BSC network WITH explicit RPC (fixes WalletConnect 401 / provider network detect)
const bscNetwork = {
  id: 56,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://bsc-dataseed.binance.org'] },
    public: { http: ['https://bsc-dataseed.binance.org'] }
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' }
  }
}

const networks = [bscNetwork]

const modal = createAppKit({
  adapters: [new EthersAdapter()],
  networks,
  metadata,
  projectId,
  features: { analytics: true }
})

// Emit events your app.js can listen to
function emit() {
  const address = modal.getAddress?.() || null
  const chainId = modal.getChainId?.() || null
  const isBsc = Number(chainId) === 56

  window.dispatchEvent(
    new CustomEvent('chainesport:wallet', {
      detail: { address, chainId, isBsc }
    })
  )
}

// Subscribe to provider/account changes
modal.subscribeProvider?.(() => emit())

// Fire once on load (handles restored sessions)
emit()

// Expose a tiny API for your site
window.ChainEsportWallet = {
  open: () => modal.open(),
  openNetworks: () => modal.open({ view: 'Networks' }),
  getAddress: () => modal.getAddress?.() || null,
  getChainId: () => modal.getChainId?.() || null
}
