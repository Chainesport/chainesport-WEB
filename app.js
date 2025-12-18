(function () {
  const $ = (s, p = document) => p.querySelector(s)
  const $$ = (s, p = document) => [...p.querySelectorAll(s)]

  // ---- Tabs ----
  const panels = ['news', 'tournaments', 'whitepaper', 'roadmap', 'team', 'contacts', 'node-login']

  function show(tab) {
    panels.forEach(t => $('#panel-' + t)?.classList.add('hidden'))
    $('#panel-' + tab)?.classList.remove('hidden')

    $$('.tab-btn').forEach(b => b.classList.remove('is-active'))
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add('is-active')

    // sidebars visibility
    $('#side-team')?.classList.add('hidden')
    $('#side-whitepaper')?.classList.add('hidden')
    $('#side-news')?.classList.add('hidden')
    $('#side-roadmap')?.classList.add('hidden')
    $('#side-tournaments')?.classList.add('hidden')

    if (tab === 'team') $('#side-team')?.classList.remove('hidden')
    if (tab === 'whitepaper') $('#side-whitepaper')?.classList.remove('hidden')
    if (tab === 'news') $('#side-news')?.classList.remove('hidden')
    if (tab === 'roadmap') $('#side-roadmap')?.classList.remove('hidden')
    if (tab === 'tournaments') $('#side-tournaments')?.classList.remove('hidden')

    location.hash = tab
  }

  $$('.tab-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)))
  window.addEventListener('hashchange', () => show((location.hash || '#news').slice(1)))
  show((location.hash || '#news').slice(1))

  // ---- Node Dashboard mock data (keep as you had) ----
  const nlGuest = $('#nl-guest')
  const nlAuthed = $('#nl-authed')
  const nlAddress = $('#nl-address')
  const nlNodesOwned = $('#nl-nodes-owned')
  const nlClaimable = $('#nl-claimable')
  const nlMonthly = $('#nl-monthly')
  const nlAlltime = $('#nl-alltime')
  const nlNodeRows = $('#nl-node-rows')
  const nlPayoutRows = $('#nl-payout-rows')
  const nlClaimBtn = $('#nl-claim-btn')
  const fmt6 = v => (Number(v || 0) / 1e6).toFixed(2)

  async function getInvestorDataMock(addr) {
    return {
      address: addr,
      nodesOwned: 1,
      claimableUSDC: 4916000000, // 4916.00
      monthUSDC: 2458000000,     // 2458.00
      nodes: [{ id: 101, active: true, uptimePct: 99.2 }],
      payouts: [
        { period: '2026-03', amount: 3000000000, tx: '0xaaaa...' },
        { period: '2026-04', amount: 3500000000, tx: '0xbbbb...' }
      ],
      allTimeOverrideUSDC: 6500000000 // 6500.00
    }
  }

  async function nlShowAuthed(addr) {
    nlGuest?.classList.add('hidden')
    nlAuthed?.classList.remove('hidden')
    if (nlAddress) nlAddress.textContent = addr

    const d = await getInvestorDataMock(addr)

    if (nlNodesOwned) nlNodesOwned.textContent = String(d.nodesOwned || 0)
    if (nlClaimable) nlClaimable.textContent = fmt6(d.claimableUSDC)
    if (nlMonthly) nlMonthly.textContent = fmt6(d.monthUSDC)
    if (nlAlltime) nlAlltime.textContent = `All-time: ${fmt6(d.allTimeOverrideUSDC)} USDC`

    // Nodes
    if (nlNodeRows) {
      nlNodeRows.innerHTML = ''
      ;(d.nodes || []).forEach(n => {
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td class="py-2 pr-4">${n.id}</td>
          <td class="py-2 pr-4">Active</td>
          <td class="py-2 pr-4">${Number(n.uptimePct || 0).toFixed(1)}%</td>
        `
        nlNodeRows.appendChild(tr)
      })
    }

    // Payouts
    if (nlPayoutRows) {
      nlPayoutRows.innerHTML = ''
      ;(d.payouts || []).forEach(p => {
        const tx = p.tx
          ? `<a class="link" target="_blank" rel="noopener" href="https://bscscan.com/tx/${p.tx}">View</a>`
          : '—'
        const tr = document.createElement('tr')
        tr.innerHTML = `
          <td class="py-2 pr-4">${p.period}</td>
          <td class="py-2 pr-4">${fmt6(p.amount)}</td>
          <td class="py-2 pr-4">${tx}</td>
        `
        nlPayoutRows.appendChild(tr)
      })
    }

    // Claim (still demo)
    if (nlClaimBtn) {
      nlClaimBtn.removeAttribute('disabled')
      nlClaimBtn.onclick = () => alert('Demo: this would call claim() on your BNB smart contract.')
    }
  }

  // ---- REAL Reown WalletConnect integration ----
  let walletConnected = false
  let walletAddress = null
  let walletChainId = null
  let walletIsBsc = false

  function shortAddr(a) {
    return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : ''
  }

  function fillHiddenWalletFields() {
    $$('.wallet-address-field').forEach(el => (el.value = walletAddress || ''))
    $$('.wallet-chainid-field').forEach(el => (el.value = walletChainId ? String(walletChainId) : ''))
  }

  function updateWalletButton() {
    const btn = $('#walletBtn')
    if (!btn) return
    if (walletConnected && walletAddress) {
      btn.textContent = `Connected: ${shortAddr(walletAddress)}`
    } else {
      btn.textContent = 'Connect Wallet'
    }
  }

  function onConnectedUI() {
    updateWalletButton()
    fillHiddenWalletFields()

    // Auto-open post connect modal if you want
    // $('#postConnectModal')?.classList.remove('hidden')
  }

  // Open Reown modal from buttons
  $('#walletBtn')?.addEventListener('click', () => {
    if (!window.ChainEsportWallet?.open) {
      alert('Wallet bundle not loaded. Check index.html includes assets/wallet.bundle.js before app.js')
      return
    }
    window.ChainEsportWallet.open()
  })

  $('#nl-connect')?.addEventListener('click', () => window.ChainEsportWallet?.open?.())

  // Receive wallet updates from wallet.src.js (bundle)
  window.addEventListener('chainesport:wallet', async (e) => {
    const d = e.detail || {}
    walletAddress = d.address || null
    walletChainId = d.chainId || null
    walletIsBsc = !!d.isBsc
    walletConnected = !!walletAddress

    onConnectedUI()

    // If connected, show Node Dashboard data using real address
    if (walletConnected) {
      await nlShowAuthed(walletAddress)
    }

    // If not on BSC, you can warn (optional)
    if (walletConnected && walletChainId && !walletIsBsc) {
      alert('Please switch to BNB Chain (BSC) to use ChainEsport.')
    }
  })

  // Set initial button state
  updateWalletButton()

  // ---- Post-connect choice modal (keep your UI) ----
  const postConnectModal = $('#postConnectModal')
  $('#postConnectClose')?.addEventListener('click', () => postConnectModal?.classList.add('hidden'))

  $('#choosePlayer')?.addEventListener('click', () => {
    postConnectModal?.classList.add('hidden')
    show('tournaments')
    const reg = $('#side-tournaments') || $('#panel-tournaments')
    reg?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })

  $('#chooseNode')?.addEventListener('click', () => {
    postConnectModal?.classList.add('hidden')
    show('node-login')
  })

  // ---- Gate chats (real wallet required) ----
  function gateJoin(sel, chatId) {
    const btn = $(`[data-join="${sel}"]`)
    const chat = $('#chat-' + chatId)
    btn?.addEventListener('click', () => {
      if (!walletConnected) {
        alert('Connect wallet first.')
        return
      }
      chat?.classList.remove('hidden')
    })
  }

  gateJoin('fifa', 'fifa')
  gateJoin('mk', 'mk')
  gateJoin('sf', 'sf')
  gateJoin('valorant', 'valorant')
  gateJoin('cs2', 'cs2')

  // ---- Player form (requires wallet + disclaimer checkbox) ----
  const playerForm = $('#playerForm')
  playerForm?.addEventListener('submit', (e) => {
    e.preventDefault()

    if (!walletConnected) {
      alert('Please connect your wallet first.')
      return
    }
    if (!$('#agreePlayer')?.checked) {
      alert('Please agree to the Player Disclaimer')
      return
    }

    // This is still demo (later we store in Supabase)
    alert('Registered (demo). Wallet saved into hidden fields.')
  })

  // NOTE:
  // Your Node Reservation forms are real Web3Forms HTML forms (they submit directly),
  // so we do NOT prevent submission here.
  // The wallet hidden fields are filled automatically via fillHiddenWalletFields().

})()
