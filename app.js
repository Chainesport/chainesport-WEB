const ESCROW_ADDRESS = "0x8f4745bE3798163e6Cfb8908645846650dF00aBA";
const USDC_ADDRESS = "0xA975B44957b6C630762b7CdfFD710A65f1CFDdad";

// Full ABI for Escrow (tells the website how to talk to your contract)
const ESCROW_ABI = [
  "function createMatch(uint256 stake) public returns (uint256)",
  "function joinMatch(uint256 matchId) public",
  "function cancelMatch(uint256 matchId) public",
  "function nextMatchId() public view returns (uint256)",
  "event MatchCreated(uint256 indexed matchId, address indexed p1, uint256 stake)"
];

// Standard ERC20 ABI for USDC
const USDC_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function decimals() public view returns (uint8)"
];
/* ============================================================
   LOGIN / WALLET PATCH (CLEAN)
   - Login opens wallet modal
   - MetaMask connects (injected)
   - WalletConnect uses wallet.bundle.js (QR)
   - Updates #walletBtn label
   - Fills #playerWalletDisplay + web3forms hidden fields
   - Emits: window.dispatchEvent("chainesport:wallet")
============================================================ */
(function () {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));

  const walletBtn = $("#walletBtn");
  const walletModal = $("#walletModal");
  const walletClose = $("#walletClose");

  const postConnectModal = $("#postConnectModal");
  const postConnectClose = $("#postConnectClose");
  const choosePlayer = $("#choosePlayer");
  const chooseNode = $("#chooseNode");

  const playerWalletDisplay = $("#playerWalletDisplay");

  let connectedAddress = null;
  let connectedChainId = null;

  function shortAddr(a) {
    if (!a || a.length < 10) return a || "";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function openModal(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.classList.add("flex");
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.classList.remove("flex");
  }

  function dispatchWallet(addr, chainId) {
    window.connectedWalletAddress = String(addr || "").toLowerCase();
    window.connectedChainId = chainId || null;

    window.dispatchEvent(
      new CustomEvent("chainesport:wallet", {
        detail: { address: addr || null, chainId: chainId || null },
      })
    );
  }

  function applyWalletToUI(addr, chainId) {
    connectedAddress = addr || null;
    connectedChainId = chainId || null;

    if (walletBtn) walletBtn.textContent = addr ? `Wallet: ${shortAddr(addr)}` : "Login";
    if (playerWalletDisplay) playerWalletDisplay.value = addr || "";

    // web3forms hidden fields
    $$(".wallet-address-field").forEach((el) => (el.value = addr || ""));
    $$(".wallet-chainid-field").forEach((el) => (el.value = chainId || ""));

    // Keep WalletConnect implementation from wallet.bundle.js if it exists
    window.ChainEsportWallet = window.ChainEsportWallet || {};
    window.ChainEsportWallet.open = () => openModal(walletModal);
    if (typeof window.ChainEsportWallet.openNetworks !== "function") {
      window.ChainEsportWallet.openNetworks = () => openModal(walletModal);
    }
    window.ChainEsportWallet.getAddress = () => connectedAddress;
    window.ChainEsportWallet.getChainId = () => connectedChainId;

    dispatchWallet(addr, chainId);
  }

  async function connectInjected() {
    if (!window.ethereum) {
      alert("No browser wallet detected. Please install MetaMask.");
      return;
    }
    try {
      // 1. Request Account
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      
      // 2. Check and Switch Network to BNB Testnet (97)
      const targetChainId = "0x61"; // Hex for 97
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });

      if (currentChainId !== targetChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: targetChainId }],
          });
        } catch (switchError) {
          // If the network is not added to MetaMask, add it automatically
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: targetChainId,
                chainName: "BNB Smart Chain Testnet",
                nativeCurrency: { name: "BNB", symbol: "tBNB", decimals: 18 },
                rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                blockExplorerUrls: ["https://testnet.bscscan.com"]
              }],
            });
          }
        }
      }

      // 3. Finalize UI Update
      const finalChainId = await window.ethereum.request({ method: "eth_chainId" });
      applyWalletToUI(addr, finalChainId);

      closeModal(walletModal);
      openModal(postConnectModal);
    } catch (e) {
      console.error("Connection error:", e);
      alert("Failed to connect wallet correctly.");
    }
  }

  function connectWalletConnect() {
    const wc = window.ChainEsportWallet?.openNetworks;
    if (typeof wc === "function") {
      closeModal(walletModal);
      wc(); // QR / WalletConnect UI
      return;
    }
    alert("WalletConnect is not available. Check that assets/wallet.bundle.js is loading.");
  }

  function wireWalletModalButtons() {
    if (!walletModal) return;

    // Use your HTML attributes:
    const wcBtn = walletModal.querySelector('button[data-wallet="walletconnect"]');
    const mmBtn = walletModal.querySelector('button[data-wallet="injected"]');

    mmBtn?.addEventListener("click", connectInjected);
    wcBtn?.addEventListener("click", connectWalletConnect);
  }

  function wireLoginUI() {
    if (!walletBtn) return;

    // prevent double-wiring if this runs more than once
    if (walletBtn.dataset.wired === "1") return;
    walletBtn.dataset.wired = "1";

    // Login button -> opens wallet modal or post-connect if already connected
    walletBtn.addEventListener("click", () => {
      if (connectedAddress) openModal(postConnectModal);
      else openModal(walletModal);
    });

    walletClose?.addEventListener("click", () => closeModal(walletModal));
    postConnectClose?.addEventListener("click", () => closeModal(postConnectModal));

    choosePlayer?.addEventListener("click", () => {
      closeModal(postConnectModal);
      document.querySelector('.tab-btn[data-tab="tournaments"]')?.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    chooseNode?.addEventListener("click", () => {
      closeModal(postConnectModal);
      document.querySelector('.tab-btn[data-tab="node-login"]')?.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    wireWalletModalButtons();

    // listeners
    if (window.ethereum?.on) {
      window.ethereum.on("accountsChanged", async (acc) => {
        const addr = acc && acc[0] ? acc[0] : null;
        const cid = await window.ethereum.request({ method: "eth_chainId" }).catch(() => connectedChainId);
        applyWalletToUI(addr, cid);
      });

      window.ethereum.on("chainChanged", (cid) => {
        applyWalletToUI(connectedAddress, cid);
      });
    }
  }

  // Run
  try { wireLoginUI(); } catch (e) { console.error(e); }
  document.addEventListener("DOMContentLoaded", () => {
    try { wireLoginUI(); } catch (e) { console.error(e); }
  });
})();


/* ============================================================
   MAIN APP
============================================================ */
(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  // DOM refs
  const walletBtn = byId("walletBtn");

  // Right side: profile + registration
  const playerForm = byId("playerForm");
  const playerProfile = byId("playerProfile");
  const playerRegLocked = byId("playerRegLocked");
  const playerWalletDisplay = byId("playerWalletDisplay");

  // Tournaments panel: create match + open matches
  const createMatchBlock = byId("create-match-block");

  // My Match (under profile)
  const myMatchBlock = byId("my-match-block");
  const myMatchDetails = byId("my-match-details");
  const myPlayersBox = byId("my-match-players");

  // My Matches list (under profile)
  const myMatchesBlock = byId("my-matches-block");
  const myMatchesList = byId("my-matches-list");

  // My Match extra blocks
  const chatBlock = byId("my-chat-block");
  const proofBlock = byId("my-proof-block");
  const confirmResultBlock = byId("my-result-block");
  const btnWon = byId("btn-won");
  const btnLost = byId("btn-lost");
  const btnDispute = byId("btn-dispute");


  // Chat UI
  const chatSend = byId("chat-send");
  const chatText = byId("chat-text");
  const chatBox = byId("chat-messages");

  // Proof UI
  const proofFile = byId("proof-file");
  const proofBtn = byId("proof-upload");
  const proofStatus = byId("proof-status");

  // KYC (disabled for testnet)
  const DISABLE_KYC = true;
  const SUMSUB_KYC_URL = "https://in.sumsub.com/websdk/p/uni_hxgnQ3PWA7q9cuGg";
  function goToKyc() {
    if (DISABLE_KYC) return;
    window.location.href = SUMSUB_KYC_URL;
  }

  // Tabs
  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  function showTab(tab) {
    if (!panels.includes(tab)) tab = "news";

    panels.forEach((t) => byId("panel-" + t)?.classList.add("hidden"));
    byId("panel-" + tab)?.classList.remove("hidden");

    $$(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    $$(`.tab-btn[data-tab="${tab}"]`).forEach((b) => b.classList.add("is-active"));

    ["team", "whitepaper", "news", "roadmap", "tournaments"].forEach((s) => byId("side-" + s)?.classList.add("hidden"));
    byId("side-" + tab)?.classList.remove("hidden");

    if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);

    if (tab === "tournaments") {
      setTimeout(() => {
        refreshPlayerUI().catch(console.error);
        renderOpenMatches().catch(console.error);
        renderMyMatchesList().catch(console.error);
        loadMyOpenMatch().catch(console.error);
      }, 250);
    }
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));

 // Post-connect modal buttons (kept)
const post = byId("postConnectModal");
byId("choosePlayer")?.addEventListener("click", () => {
  post?.classList.add("hidden");
  showTab("tournaments");

  // ✅ force refresh after switching tab (important when wallet already connected)
  setTimeout(() => {
    refreshPlayerUI().catch(console.error);
    renderOpenMatches().catch(console.error);
    renderMyMatchesList().catch(console.error);
    loadMyOpenMatch().catch(console.error);
  }, 150);
});

  byId("chooseNode")?.addEventListener("click", () => {
    post?.classList.add("hidden");
    showTab("node-login");
  });
  byId("postConnectClose")?.addEventListener("click", () => post?.classList.add("hidden"));

  // Wallet UI helpers
  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? String(address).toLowerCase() : "";
    window.connectedWalletAddress = addr;
    window.connectedChainId = chainId ?? null;

    if (walletBtn) walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Login";

    // fill wallet in forms
    if (playerWalletDisplay) playerWalletDisplay.value = address || "";
    $$(".wallet-address-field").forEach((i) => (i.value = address || ""));
    $$(".wallet-chainid-field").forEach((i) => (i.value = chainId || ""));
  }

  // IMPORTANT:
  // DO NOT add another walletBtn click handler here.
  // The LOGIN / WALLET PATCH already handles the Login click + modal.

  window.addEventListener("chainesport:wallet", (ev) => {
    setWalletUI(ev?.detail?.address, ev?.detail?.chainId);
    refreshPlayerUI().catch(console.error);
    renderOpenMatches().catch(console.error);
    loadMyOpenMatch().catch(console.error);
  });

  function syncWallet() {
    setWalletUI(
      window.ChainEsportWallet?.getAddress?.() || null,
      window.ChainEsportWallet?.getChainId?.() || null
    );
  }

  syncWallet();
  let tries = 0;
  const syncInt = setInterval(() => {
    syncWallet();
    if (window.connectedWalletAddress || ++tries > 20) clearInterval(syncInt);
  }, 250);

  const getWallet = () => (window.connectedWalletAddress || window.ethereum?.selectedAddress || "").toLowerCase().trim();

  // Supabase
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";
  window.SUPABASE_ANON_KEY = SUPABASE_KEY;

  let sbClient;
  async function getSupabase() {
    if (sbClient) return sbClient;

    if (!window.supabase?.createClient) {
      await new Promise((r) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = r;
        document.head.appendChild(s);
      });
    }

    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.sb = sbClient; // debug
    return sbClient;
  }

  // Disclaimers check (Create + Join)
  function getDisclaimersAccepted() {
    const a1 = byId("agree-match-1")?.checked;
    const a2 = byId("agree-match-2")?.checked;
    const a3 = byId("agree-match-3")?.checked;
    return !!(a1 && a2 && a3);
  }

  // Player UI: show form or profile
  async function refreshPlayerUI() {
    const wallet = getWallet();

    if (!wallet) {
      playerRegLocked?.classList.remove("hidden");
      playerForm?.classList.add("hidden");
      playerProfile?.classList.add("hidden");
      createMatchBlock?.classList.add("hidden");
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    playerRegLocked?.classList.add("hidden");
    if (playerWalletDisplay) playerWalletDisplay.value = wallet;

    let p = null;
    try {
      const sb = await getSupabase();
      const walletLc = String(wallet || "").toLowerCase();

      const res = await sb.from("players").select("*").eq("wallet_address", walletLc).maybeSingle();
      if (res?.error) console.error("[refreshPlayerUI] lookup error:", res.error);
      p = res?.data || null;
    } catch (e) {
      console.warn("Supabase not ready yet", e);
    }

    if (!p) {
      playerForm?.classList.remove("hidden");
      playerProfile?.classList.add("hidden");
      createMatchBlock?.classList.add("hidden");
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    // Registered
    playerForm?.classList.add("hidden");
    playerProfile?.classList.remove("hidden");
    createMatchBlock?.classList.remove("hidden");

    // Profile fields
    byId("pp-nickname") && (byId("pp-nickname").textContent = p.nickname || "—");
    byId("pp-games") && (byId("pp-games").textContent = p.games || "—");
    byId("pp-language") && (byId("pp-language").textContent = p.language || "—");

    const gamesInput = byId("pp-games-input");
    if (gamesInput) gamesInput.value = p.games || "";

    const langInput = byId("pp-language-input");
    if (langInput) langInput.value = p.language || "";

    const wins = Number(p.wins ?? 0);
    const losses = Number(p.losses ?? 0);
    byId("pp-wl") && (byId("pp-wl").textContent = `${wins}/${losses}`);

    const img = byId("pp-avatar");
    if (img) img.src = p.avatar_url || "assets/avatar_placeholder.png";

    await renderMyMatchesList();
    await loadMyOpenMatch();
  }
  window.refreshPlayerUI = refreshPlayerUI;

  // Player Registration (DB + email)
  const WEB3FORMS_ACCESS_KEY = "d65b6c71-2e83-43e5-ac75-260fe16f91af";

  playerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const agree = byId("agreePlayer")?.checked;
    if (!agree) return alert("Please accept the disclaimer checkbox");

    const formData = new FormData(playerForm);
    const nickname = String(formData.get("nickname") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const realName = String(formData.get("real_name") || "").trim();

    if (!nickname || !email || !realName) return alert("Fill Nickname, Email, Real Name");

    const sb = await getSupabase();
    const { error } = await sb.from("players").upsert({
      wallet_address: String(wallet || "").toLowerCase(),
      nickname,
      email,
      real_name: realName,
    });

    if (error) {
      console.error(error);
      return alert("Registration error: " + error.message);
    }

    // email (best effort)
    try {
      const sendData = new FormData();
      sendData.append("access_key", WEB3FORMS_ACCESS_KEY);
      sendData.append("subject", "New Player Registration");
      sendData.append("wallet_address", wallet);
      sendData.append("nickname", nickname);
      sendData.append("email", email);
      sendData.append("real_name", realName);

      await fetch("https://api.web3forms.com/submit", { method: "POST", body: sendData });
    } catch (err) {
      console.warn("Email failed (DB saved OK):", err);
    }

    alert("Registered ✅");
    await refreshPlayerUI();
    showTab("tournaments");
  });

 // Create Match (Blockchain + Database Sync)
  byId("cm-create")?.addEventListener("click", async () => {
    const btn = byId("cm-create");
    const wallet = getWallet();
    if (!wallet) return alert("Please connect your wallet first.");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first.");

    const game = String(byId("cm-game")?.value || "").trim();
    const conditions = String(byId("cm-conditions")?.value || "").trim();
    const entryAmount = byId("cm-entry")?.value;

    if (!game || !entryAmount || Number(entryAmount) <= 0) {
      return alert("Please fill Game and a valid Entry Fee.");
    }

    try {
      btn.disabled = true;
      btn.textContent = "WAITING FOR WALLET...";

      // 1. Setup Ethers (Blockchain connection)
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      // 2. Handle Decimals (MockUSDC is 18 decimals)
      const decimals = await usdcContract.decimals();
      const amountToLock = ethers.utils.parseUnits(entryAmount.toString(), decimals);

      // 3. Step A: APPROVE USDC
      btn.textContent = "APPROVING USDC...";
      const appTx = await usdcContract.approve(ESCROW_ADDRESS, amountToLock);
      await appTx.wait(); 

      // 4. Step B: CREATE MATCH ON CHAIN
      btn.textContent = "CONFIRMING MATCH...";
      const createTx = await escrowContract.createMatch(amountToLock);
      const receipt = await createTx.wait();

      // 5. READ the MatchID from the Blockchain Event
      const event = receipt.events.find(e => e.event === 'MatchCreated');
      const blockchainMatchId = event.args.matchId.toString();

      // 6. SAVE TO SUPABASE (Only now that money is actually locked!)
      btn.textContent = "SAVING TO SYSTEM...";
      const sb = await getSupabase();
      const { error: dbErr } = await sb.from("matches").insert({
        id: blockchainMatchId, 
        creator_wallet: wallet.toLowerCase(),
        game,
        conditions,
        entry_fee: entryAmount,
        status: "open",
      });

      if (dbErr) throw dbErr;

      // Add Creator to participants table
      await sb.from("match_participants").insert({
        match_id: blockchainMatchId,
        wallet_address: wallet.toLowerCase(),
        role: "creator"
      });

      alert(`Match Created! Blockchain ID: ${blockchainMatchId} 🎮`);
      
      // Clear fields and Refresh
      if (byId("cm-game")) byId("cm-game").value = "";
      if (byId("cm-conditions")) byId("cm-conditions").value = "";
      if (byId("cm-entry")) byId("cm-entry").value = "";

      await renderOpenMatches();
      await renderMyMatchesList();
      await loadMyOpenMatch();

    } catch (err) {
      console.error("Blockchain Error:", err);
      alert("Failed: " + (err.data?.message || err.message));
    } finally {
      btn.disabled = false;
      btn.textContent = "CREATE";
    }
  });
  // Open matches list
async function renderOpenMatches() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const list = byId("matches-list");
    if (!list) return;

    const { data: matches, error: mErr } = await sb
      .from("matches")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (mErr) {
      console.error(mErr);
      list.innerHTML = `<div class="text-sm">Error: ${mErr.message}</div>`;
      return;
    }

    const { data: parts } = wallet
      ? await sb.from("match_participants").select("match_id").eq("wallet_address", String(wallet).toLowerCase())
      : { data: [] };

    const joined = new Set((parts || []).map((p) => p.match_id));

    list.innerHTML = "";
    if (!matches || !matches.length) {
      list.innerHTML = `<div class="text-sm text-muted text-center py-10">No open matches yet. Be the first to create one!</div>`;
      return;
    }

    // Improved Match Card Layout
    matches.forEach((m) => {
      const disabled = joined.has(m.id);
      const card = document.createElement("div");
      card.className = "card-2 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 " + (disabled ? "border-gray-500" : "border-[#FFD84D]");

      card.innerHTML = `
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] bg-[#FFD84D] text-black px-2 py-0.5 rounded font-bold uppercase">LIVE LOBBY</span>
            <span class="text-xs text-muted font-mono">${m.id.slice(0,8)}</span>
          </div>
          <h3 class="text-xl font-extrabold text-white uppercase tracking-tight">${m.game}</h3>
          <p class="text-sm text-muted mb-2">${m.conditions || "Standard Rules"}</p>
          <div class="flex items-center gap-3">
             <div class="text-[#FFD84D] font-bold text-lg">${m.entry_fee} <span class="text-xs">USDC</span></div>
             <div class="text-xs text-muted border-l border-line pl-3">1 vs 1</div>
          </div>
        </div>
        <div class="w-full sm:w-auto">
          <button class="btn w-full sm:w-32 py-3 ${disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105 transition-transform"}" 
            data-join-id="${m.id}" ${disabled ? "disabled" : ""}>
            ${disabled ? "JOINED" : "JOIN MATCH"}
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // My Matches list (ALL matches under profile)  ✅ keep only ONE version
  async function renderMyMatchesList() {
    const wallet = getWallet();

    if (!myMatchesList) return;

    if (!wallet) {
      myMatchesList.innerHTML = `<div class="text-sm text-muted">Connect wallet to see your matches.</div>`;
      return;
    }

    const sb = await getSupabase();

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("match_id")
      .eq("wallet_address", String(wallet || "").toLowerCase());

    if (pErr) {
      console.error(pErr);
      myMatchesList.innerHTML = `<div class="text-sm">Error: ${pErr.message}</div>`;
      return;
    }

    const ids = (parts || []).map((p) => p.match_id);
    if (!ids.length) {
      myMatchesList.innerHTML = `<div class="text-sm text-muted">No matches yet.</div>`;
      return;
    }

    const { data: matches, error: mErr } = await sb
      .from("matches")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });

    if (mErr) {
      console.error(mErr);
      myMatchesList.innerHTML = `<div class="text-sm">Error: ${mErr.message}</div>`;
      return;
    }

    myMatchesList.innerHTML = "";

    (matches || []).forEach((m) => {
      const div = document.createElement("div");
      div.className = "card-2 p-3 flex items-center justify-between gap-3";

      const active = String(window.__chainesportCurrentMatchId || "") === String(m.id);

      div.innerHTML = `
        <div class="min-w-0">
          <div class="font-bold truncate">${m.game || "Match"}</div>
          <div class="text-xs opacity-80">Entry: ${m.entry_fee} USDC • Status: ${m.status}</div>
        </div>
        <button class="btn" type="button" data-my-match-id="${m.id}">
          ${active ? "OPENED" : "OPEN"}
        </button>
      `;

      myMatchesList.appendChild(div);
    });

    // show wrapper block if exists
    myMatchesBlock?.classList.remove("hidden");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-my-match-id]");
    if (!b) return;

    window.__chainesportCurrentMatchId = String(b.getAttribute("data-my-match-id") || "");
    loadMyOpenMatch().catch(console.error);
    renderMyMatchesList().catch(console.error);
  });

 // Join Match (Blockchain + Database Sync)
  async function joinMatch(matchId) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    try {
      // 1. Get Match Info from DB (to know the price)
      const { data: m, error: mErr } = await sb.from("matches").select("entry_fee").eq("id", matchId).single();
      if (mErr || !m) throw new Error("Match not found.");

      // 2. Setup Ethers
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      // 3. Handle Decimals (MockUSDC)
      const decimals = await usdcContract.decimals();
      const amountToLock = ethers.utils.parseUnits(m.entry_fee.toString(), decimals);

      // 4. Step A: APPROVE USDC
      alert(`To join, you need to lock ${m.entry_fee} USDC. Please confirm Approval in your wallet.`);
      const appTx = await usdcContract.approve(ESCROW_ADDRESS, amountToLock);
      await appTx.wait();

      // 5. Step B: JOIN MATCH ON CHAIN
      alert("Approval successful! Now confirming entry on the blockchain...");
      const joinTx = await escrowContract.joinMatch(matchId);
      await joinTx.wait();

      // 6. SAVE TO SUPABASE (Only now that transaction is confirmed)
      const { error } = await sb.from("match_participants").insert({
        match_id: matchId,
        wallet_address: wallet.toLowerCase(),
        role: "opponent"
      });

      if (error) throw error;

      alert("Joined successfully! 🎮 Money is secured in Escrow.");
      
      // Refresh UI
      await renderOpenMatches();
      await renderMyMatchesList();
      await loadMyOpenMatch();

    } catch (err) {
      console.error("Join Error:", err);
      alert("Failed to join: " + (err.data?.message || err.message));
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (!btn || btn.disabled) return;
    joinMatch(btn.getAttribute("data-join-id")).catch(console.error);
  });

  // Improved Active Match Lobby
  async function loadMyOpenMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();

    if (playerProfile?.classList.contains("hidden") || !wallet) {
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("match_id")
      .eq("wallet_address", String(wallet).toLowerCase());

    const ids = (parts || []).map((p) => p.match_id);
    if (!ids.length) {
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    // Get the most recent active match
    const { data: matches, error: mErr } = await sb
      .from("matches")
      .select("*")
      .in("id", ids)
      .in("status", ["open", "locked", "disputed", "finished", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1);

    const m = matches?.[0];
    if (!m) {
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    window.__chainesportCurrentMatchId = String(m.id);
    myMatchBlock?.classList.remove("hidden");

    // 1. Get all participants to show the "Versus" UI
    const { data: allParticipants } = await sb
      .from("match_participants")
      .select("wallet_address, role")
      .eq("match_id", m.id);

    const opponent = allParticipants?.find(p => p.role === "opponent");
    const creator = allParticipants?.find(p => p.role === "creator");
    const isFull = allParticipants?.length >= 2;

   // 2. Build a "Battle Header" UI with Cancel Option
    if (myMatchDetails) {
      const isCreator = creator?.wallet_address.toLowerCase() === wallet.toLowerCase();
      
      myMatchDetails.innerHTML = `
        <div class="text-center mb-4">
          <div class="text-[10px] text-[#FFD84D] font-bold tracking-widest uppercase mb-1">Active Lobby</div>
          <h2 class="text-2xl font-black text-white uppercase italic">${m.game}</h2>
          <div class="inline-block bg-navy px-3 py-1 rounded-full border border-line mt-2">
            <span class="text-[#FFD84D] font-bold">${m.entry_fee} USDC</span> Pool
          </div>
        </div>
        
        <div class="flex items-center justify-between gap-2 bg-black/20 p-3 rounded-xl border border-line mb-4">
          <div class="flex-1 text-center">
            <div class="text-[10px] text-muted uppercase">Creator</div>
            <div class="text-xs font-mono text-white">${shortAddr(creator?.wallet_address)}</div>
          </div>
          <div class="text-[#FFD84D] font-black italic text-xl">VS</div>
          <div class="flex-1 text-center">
            <div class="text-[10px] text-muted uppercase">Opponent</div>
            <div class="text-xs font-mono ${opponent ? "text-white" : "text-gray-600"}">
              ${opponent ? shortAddr(opponent.wallet_address) : "WAITING..."}
            </div>
          </div>
        </div>

        <div class="text-xs text-center text-muted mb-4">
          ${isFull ? "🟢 Match is Live! Use chat to coordinate." : "🟡 Waiting for an opponent to join..."}
        </div>

        ${(!isFull && isCreator) ? `
          <div class="text-center">
            <button class="btn-ghost text-red-400 border-red-900/30 text-xs py-2 px-4 hover:bg-red-900/20" id="btn-cancel-match">
              CANCEL MATCH & REFUND
            </button>
            <p class="text-[10px] text-muted mt-2">Funds are locked in Escrow until you cancel or a player joins.</p>
          </div>
        ` : ""}
      `;

      // Wire up the cancel button action
      const cancelBtn = document.getElementById("btn-cancel-match");
      if (cancelBtn) {
        cancelBtn.onclick = () => cancelMatch(m.id);
      }
    }
    // 3. Show/Hide Chat and Result sections based on if the match has started
    if (isFull) {
      chatBlock?.classList.remove("hidden");
      proofBlock?.classList.remove("hidden");
      confirmResultBlock?.classList.remove("hidden");
      await loadChat();
      startChatAutoRefresh();
    } else {
      chatBlock?.classList.add("hidden");
      proofBlock?.classList.add("hidden");
      confirmResultBlock?.classList.add("hidden");
      stopChatAutoRefresh();
    }
  }

  // Professional Chat Bubbles
  async function loadChat() {
    const sb = await getSupabase();
    const matchId = window.__chainesportCurrentMatchId;
    const myWallet = getWallet().toLowerCase();
    
    if (!matchId || !chatBox) return;

    const { data, error } = await sb
      .from("match_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    chatBox.innerHTML = "";
    
    (data || []).forEach((m) => {
      const isMe = String(m.sender_wallet).toLowerCase() === myWallet;
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const wrapper = document.createElement("div");
      wrapper.className = `flex w-full mb-3 ${isMe ? "justify-end" : "justify-start"}`;

      wrapper.innerHTML = `
        <div class="max-w-[80%]">
          <div class="text-[10px] text-muted mb-1 ${isMe ? "text-right" : "text-left"} uppercase tracking-tighter">
            ${isMe ? "You" : "Opponent"} • ${time}
          </div>
          <div class="px-3 py-2 rounded-2xl text-sm ${
            isMe 
            ? "bg-[#FFD84D] text-black rounded-tr-none" 
            : "bg-[#1E2A3A] text-white rounded-tl-none border border-line"
          }">
            ${m.message}
          </div>
        </div>
      `;
      chatBox.appendChild(wrapper);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  }
  // Improved Proof Upload & Stream Link logic
  async function uploadMatchProof() {
    const sb = await getSupabase();
    const wallet = getWallet().toLowerCase();
    const matchId = window.__chainesportCurrentMatchId;
    const btn = byId("proof-upload");

    if (!wallet || !matchId) return alert("No active match found.");
    if (!proofFile?.files?.length) return alert("Please select a screenshot first.");

    try {
      btn.disabled = true;
      btn.textContent = "UPLOADING...";
      if (proofStatus) proofStatus.innerHTML = "⌛ Processing image...";

      const file = proofFile.files[0];
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const filePath = `${matchId}/${wallet}_${Date.now()}.${ext}`;

      // 1. Upload to Supabase Storage
      const { error: uploadErr } = await sb.storage.from("match-proofs").upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      // 2. Get Public URL
      const { data: pub } = sb.storage.from("match-proofs").getPublicUrl(filePath);
      const imageUrl = pub?.publicUrl || "";

      // 3. Save to Database
      const { error: dbErr } = await sb.from("match_proofs").upsert({
        match_id: matchId,
        wallet_address: wallet,
        image_url: imageUrl,
      });
      if (dbErr) throw dbErr;

      // 4. Notify in chat
      await sb.from("match_messages").insert({
        match_id: matchId,
        sender_wallet: wallet,
        message: "🖼️ [SYSTEM] I have uploaded a screenshot as proof.",
      });

      if (proofStatus) proofStatus.innerHTML = "✅ Proof uploaded successfully!";
      alert("Screenshot saved! 📸");
      await loadChat();

    } catch (err) {
      console.error(err);
      alert("Upload failed: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "UPLOAD PROOF";
    }
  }

  // Handle Stream Link Saving
  byId("proof-stream-save")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const link = String(byId("proof-stream-link")?.value || "").trim();
    const wallet = getWallet().toLowerCase();
    const matchId = window.__chainesportCurrentMatchId;
    const btn = byId("proof-stream-save");

    if (!link) return alert("Please paste a link first.");
    if (!link.includes("http")) return alert("Please provide a valid URL (starting with http).");

    try {
      btn.disabled = true;
      btn.textContent = "SAVING...";

      const { error } = await sb.from("match_proofs").upsert({
        match_id: matchId,
        wallet_address: wallet,
        stream_url: link
      });

      if (error) throw error;

      await sb.from("match_messages").insert({
        match_id: matchId,
        sender_wallet: wallet,
        message: "🎥 [SYSTEM] I have added a stream/video link as proof.",
      });

      alert("Video link saved! 🎥");
      await loadChat();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "SAVE LINK";
    }
  });

  proofBtn?.addEventListener("click", () => uploadMatchProof().catch(console.error));
   // Professional Result Claims
  async function setMatchOutcome(action) {
    const sb = await getSupabase();
    const wallet = getWallet().toLowerCase();
    const matchId = window.__chainesportCurrentMatchId;

    if (!wallet || !matchId) return alert("No active match found.");

    // 1. Confirmation (Crucial for Esport platforms)
    const confirmMsg = action === 'dispute' 
      ? "Are you sure you want to open a DISPUTE? An admin will review the proofs."
      : `Are you sure you want to claim a ${action.toUpperCase()}? False claims may lead to a permanent ban.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      // 2. Disable buttons to prevent double-submitting
      [btnWon, btnLost, btnDispute].forEach(b => { if(b) b.disabled = true; });

      // 3. Determine status based on action
      let newStatus = "in_progress";
      if (action === "dispute") newStatus = "disputed";
      if (action === "won" || action === "lost") newStatus = "locked"; // Locked means waiting for admin/system verification

      // 4. Update the Match Status
      const { error: matchErr } = await sb
        .from("matches")
        .update({ status: newStatus })
        .eq("id", matchId);

      if (matchErr) throw matchErr;

      // 5. Send System Notification to Chat
      const systemIcon = action === "won" ? "🏆" : (action === "lost" ? "❌" : "⚠️");
      await sb.from("match_messages").insert({
        match_id: matchId,
        sender_wallet: wallet,
        message: `${systemIcon} [SYSTEM] I have claimed a ${action.toUpperCase()}.`,
      });

      alert(`Result ${action.toUpperCase()} has been submitted! ✅`);
      
      // 6. Refresh UI
      await renderMyMatchesList();
      await loadMyOpenMatch();
      await loadChat();

    } catch (err) {
      console.error(err);
      alert("Error saving result: " + err.message);
      [btnWon, btnLost, btnDispute].forEach(b => { if(b) b.disabled = false; });
    }
  }

  // Button Listeners
  btnWon?.addEventListener("click", () => setMatchOutcome("won"));
  btnLost?.addEventListener("click", () => setMatchOutcome("lost"));
  btnDispute?.addEventListener("click", () => setMatchOutcome("dispute"));


  // Chat auto refresh
  let chatTimer = null;
  function startChatAutoRefresh() {
    if (chatTimer) return;
    chatTimer = setInterval(() => {
      if (!window.__chainesportCurrentMatchId) return;
      if (chatBlock?.classList.contains("hidden")) return;
      loadChat().catch(console.error);
    }, 4000);
  }
  function stopChatAutoRefresh() {
    if (chatTimer) clearInterval(chatTimer);
    chatTimer = null;
  }

  // Boot
  getSupabase().then(() => refreshPlayerUI()).catch(console.error);
  // Cancel Match & Refund logic
  async function cancelMatch(matchId) {
    if (!confirm("Are you sure? This will refund your USDC and remove the match.")) return;

    const btn = document.getElementById("btn-cancel-match");
    try {
      if (btn) { btn.disabled = true; btn.textContent = "REFUNDING..."; }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      // 1. Blockchain Refund
      const tx = await escrowContract.cancelMatch(matchId);
      await tx.wait();

      // 2. Sync Database
      const sb = await getSupabase();
      await sb.from("matches").update({ status: "cancelled" }).eq("id", matchId);

      alert("Match cancelled successfully. Funds have been returned! 💸");
      
      // Refresh all lists
      await renderOpenMatches();
      await renderMyMatchesList();
      await loadMyOpenMatch();

    } catch (err) {
      console.error("Cancel Error:", err);
      alert("Blockchain Error: " + (err.data?.message || err.message));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "CANCEL MATCH & REFUND"; }
    }
  }
})();
