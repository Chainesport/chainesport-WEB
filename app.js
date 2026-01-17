window.ESCROW_ADDRESS = "0x8f4745bE3798163e6Cfb8908645846650dF00aBA";
window.USDC_ADDRESS = "0xA975B44957b6C630762b7CdfFD710A65f1CFDdad";
window.ESCROW_ABI = [
  "function createMatch(uint256 stake) public returns (uint256)",
  "function joinMatch(uint256 matchId) public",
  "function cancelMatch(uint256 matchId) public",
  "function nextMatchId() public view returns (uint256)",
  "event MatchCreated(uint256 indexed matchId, address indexed p1, uint256 stake)"
];
window.USDC_ABI = [
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function allowance(address owner, address spender) public view returns (uint256)",
  "function decimals() public view returns (uint8)"
];

const byId = (id) => document.getElementById(id);
window.applyWalletToUI = function(addr, chainId) {
    const walletBtn = byId("walletBtn");
    const playerWalletDisplay = byId("playerWalletDisplay");

    window.connectedWalletAddress = addr ? String(addr).toLowerCase() : null;

    if (walletBtn) {
        walletBtn.textContent = addr ? `Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}` : "Login";
    }
    if (playerWalletDisplay) {
        playerWalletDisplay.value = addr ? addr : ""; // Show wallet address only when connected
    }

    if (addr) {
        window.dispatchEvent(new CustomEvent("chainesport:wallet", { detail: { address: addr, chainId } }));
        console.log("Connected wallet address:", addr);
    } else {
        console.log("No wallet connected.");
    }
};

window.connectInjected = async function() {
    const statusText = byId("loginStatus");
    const loginModal = byId("loginModal");

    if (!window.ethereum) {
    alert("No wallet detected! Please install a browser wallet like MetaMask or enable your wallet extension.");
    return null;
}

if (window.ethereum?.isMetaMask || window.ethereum?.isTrust || window.ethereum?.isSafePal) {
    console.log("Wallet detected:", window.ethereum.isMetaMask ? "MetaMask" : window.ethereum.isTrust ? "Trust Wallet" : "SafePal");
} else {
    alert("A supported wallet was not detected. Please install MetaMask, Trust Wallet, or SafePal.");
    return null;
}
    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const addr = accounts[0];
        const targetChainId = "0x61"; 

        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetChainId }],
            });
        } catch (err) {
            if (err.code === 4902) {
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

        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        window.connectedWalletAddress = addr.toLowerCase();
        window.applyWalletToUI(addr, chainId);
        
        if (typeof window.refreshPlayerUI === "function") await window.refreshPlayerUI();
        if (loginModal) loginModal.style.display = "none";
        if (statusText) statusText.innerText = "";

        return addr;
   } catch (e) {
        console.error("Wallet connection failed:", e);
        const errStatus = byId("loginStatus");
        if (errStatus) errStatus.innerText = ""; // Clear the hang message
        return null;
    }
};

window.wireLoginUI = async function() {
    const btnPlayer = byId("btnPlayerLogin");
    const btnNode = byId("btnNodeLogin");

    if (btnPlayer) {
        btnPlayer.onclick = async () => {
            const statusText = byId("loginStatus");
            if (statusText) statusText.innerText = "Check your Wallet...";
            const addr = await window.connectInjected();
            if (addr && typeof window.showTab === "function") {
                await window.showTab("tournaments");
            }
        };
    }

    if (btnNode) {
        btnNode.onclick = async () => {
            const statusText = byId("loginStatus");
            if (statusText) statusText.innerText = "Check your Wallet...";
            const addr = await window.connectInjected();
            if (addr && typeof window.showTab === "function") {
                await window.showTab("node-login");
            }
        };
    }

    if (window.ethereum) {
        window.ethereum.on('accountsChanged', async (accs) => {
            window.applyWalletToUI(accs[0], null);
            if (typeof window.refreshPlayerUI === "function") await window.refreshPlayerUI();
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.wireLoginUI().catch(console.error);
});
(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

// Global UI references within this scope
let walletBtn, playerForm, playerProfile, sideTournaments, playerRegLocked, playerWalletDisplay;
let createMatchBlock, myMatchBlock, myMatchDetails, myPlayersBox, myMatchesBlock, myMatchesList;
let chatBlock, proofBlock, confirmResultBlock, btnWon, btnLost, btnDispute;
let chatSend, chatText, chatBox, proofFile, proofBtn, proofStatus;

function initUIElements() {
    walletBtn = byId("walletBtn");
    playerForm = byId("playerForm");
    playerProfile = byId("playerProfile");
    sideTournaments = byId("side-tournaments");
    playerRegLocked = byId("playerRegLocked");
    playerWalletDisplay = byId("playerWalletDisplay");
    createMatchBlock = byId("create-match-block");
    myMatchBlock = byId("my-match-block");
    myMatchDetails = byId("my-match-details");
    myPlayersBox = byId("my-match-players");
    myMatchesBlock = byId("my-matches-block");
    myMatchesList = byId("my-matches-list");
    chatBlock = byId("my-chat-block");
    proofBlock = byId("my-proof-block");
    confirmResultBlock = byId("my-result-block");
    btnWon = byId("btn-won");
    btnLost = byId("btn-lost");
    btnDispute = byId("btn-dispute");
    chatSend = byId("chat-send");
    chatText = byId("chat-text");
    chatBox = byId("chat-messages");
    proofFile = byId("proof-file");
    proofBtn = byId("proof-upload");
    proofStatus = byId("proof-status");
}

document.addEventListener("DOMContentLoaded", () => {
    initUIElements();
    console.log("UI Elements initialized.");
});

  const DISABLE_KYC = true;
  const SUMSUB_KYC_URL = "https://in.sumsub.com/websdk/p/uni_hxgnQ3PWA7q9cuGg";
  function goToKyc() {
    if (DISABLE_KYC) return;
    window.location.href = SUMSUB_KYC_URL;
  }

  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  async function showTab(tab) {
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

const post = byId("postConnectModal");
byId("choosePlayer")?.addEventListener("click", () => {
  post?.classList.add("hidden");

  if(!window.connectedWalletAddress && window.ethereum?.selectedAddress) {
      window.connectedWalletAddress = window.ethereum.selectedAddress.toLowerCase();
  }

  showTab("tournaments");

  setTimeout(async () => {
    await refreshPlayerUI();
    await renderOpenMatches();
    await renderMyMatchesList();
    await loadMyOpenMatch();
  }, 400);
});

  byId("chooseNode")?.addEventListener("click", () => {
    post?.classList.add("hidden");
    showTab("node-login");
  });
  byId("postConnectClose")?.addEventListener("click", () => post?.classList.add("hidden"));

// Clean utility functions
window.shortAddr = (a) => a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
window.getWallet = () => (window.connectedWalletAddress || window.ethereum?.selectedAddress || "").toLowerCase().trim();

window.setWalletUI = async function(address, chainId) {
    const addr = address ? String(address).toLowerCase() : "";
    window.connectedWalletAddress = addr;
    
    const walletBtn = byId("walletBtn");
    if (walletBtn) walletBtn.textContent = addr ? `Connected: ${window.shortAddr(addr)}` : "Login";
    
    const playerWalletDisplay = byId("playerWalletDisplay");
    if (playerWalletDisplay) playerWalletDisplay.value = addr;

    // Trigger data refresh if we just connected
    if (addr) {
        await window.refreshPlayerUI();
        await window.renderOpenMatches();
    }
};

window.addEventListener("chainesport:wallet", async (ev) => {
    await window.setWalletUI(ev?.detail?.address, ev?.detail?.chainId);
});

// Auto-detect existing connection on load
document.addEventListener("DOMContentLoaded", async () => {
    if (window.ethereum && window.ethereum.selectedAddress) {
        await window.setWalletUI(window.ethereum.selectedAddress, null);
    }
});

  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ3hhaG1mdXp3dWV1Zm55YnYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNjkxMzA5OCwiZXhwIjoyMDUyNDg5MDk4fQ.G_R1HahzXHLSPjZbxOxXAg_annYzsxX";

  window.getSupabase = async function() {
    if (window.sb) return window.sb;
    if (typeof supabase === "undefined") {
        console.error("Supabase script missing from HTML.");
        return null;
    }
    window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return window.sb;
  };
  // Internal alias for the IIFE code
  const getSupabase = window.getSupabase;
  function getDisclaimersAccepted() {
    const a1 = byId("agree-match-1")?.checked;
    const a2 = byId("agree-match-2")?.checked;
    const a3 = byId("agree-match-3")?.checked;
    return !!(a1 && a2 && a3);
  }

window.refreshPlayerUI = async function() {
  if (typeof initUIElements === "function") initUIElements();
    const wallet = (window.connectedWalletAddress || window.ethereum?.selectedAddress || "").toLowerCase().trim();
    const playerRegLocked = byId("playerRegLocked");
    const playerForm = byId("playerForm");
    const playerProfile = byId("playerProfile");
    const sideTournaments = byId("side-tournaments");
    const createMatchBlock = byId("create-match-block");

    if (!wallet) {
      if (sideTournaments) sideTournaments.classList.add("hidden");
      if (playerRegLocked) playerRegLocked.classList.remove("hidden");
      if (playerForm) playerForm.classList.add("hidden");
      if (playerProfile) playerProfile.classList.add("hidden");
      return;
    }

    if (playerRegLocked) playerRegLocked.classList.add("hidden");
    
    let p = null;
    try {
      const sb = await getSupabase();
      const { data } = await sb.from("players").select("*").eq("wallet_address", wallet).maybeSingle();
      p = data;
    } catch (e) { console.error("Database fetch failed", e); }

    const activeBtn = document.querySelector('.tab-btn.is-active');
    const currentTab = activeBtn ? activeBtn.dataset.tab : "news";
    
    if (currentTab === "tournaments") {
       if (sideTournaments) sideTournaments.classList.remove("hidden");
       
       if (!p) {
          if (playerForm) playerForm.classList.remove("hidden");
          if (playerProfile) playerProfile.classList.add("hidden");
          if (createMatchBlock) createMatchBlock.classList.add("hidden");
       } else {
          if (playerForm) playerForm.classList.add("hidden");
          if (playerProfile) playerProfile.classList.remove("hidden");
          if (createMatchBlock) createMatchBlock.classList.remove("hidden");
          
          if (byId("pp-nickname")) byId("pp-nickname").textContent = p.nickname || "—";
          if (byId("pp-games")) byId("pp-games").textContent = p.games || "—";
          if (byId("pp-language")) byId("pp-language").textContent = p.language || "—";
          if (byId("pp-wl")) byId("pp-wl").textContent = `${p.wins || 0}/${p.losses || 0}`;
          if (byId("pp-avatar")) byId("pp-avatar").src = p.avatar_url || "assets/avatar_placeholder.png";

          if (typeof loadMyOpenMatch === "function") await loadMyOpenMatch();
          if (typeof renderMyMatchesList === "function") await renderMyMatchesList();
       }
    } else {
       if (sideTournaments) sideTournaments.classList.add("hidden");
    }
};

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

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const decimals = await usdcContract.decimals();
      const amountToLock = ethers.utils.parseUnits(entryAmount.toString(), decimals);

      btn.textContent = "APPROVING USDC...";
      const appTx = await usdcContract.approve(ESCROW_ADDRESS, amountToLock);
      await appTx.wait(); 

      btn.textContent = "CONFIRMING MATCH...";
      const createTx = await escrowContract.createMatch(amountToLock);
      const receipt = await createTx.wait();

      const event = receipt.events.find(e => e.event === 'MatchCreated');
      const blockchainMatchId = event.args.matchId.toString();

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

      await sb.from("match_participants").insert({
        match_id: blockchainMatchId,
        wallet_address: wallet.toLowerCase(),
        role: "creator"
      });

      alert(`Match Created! Blockchain ID: ${blockchainMatchId} 🎮`);
      
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

    myMatchesBlock?.classList.remove("hidden");
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-my-match-id]");
    if (!b) return;

    window.__chainesportCurrentMatchId = String(b.getAttribute("data-my-match-id") || "");
    loadMyOpenMatch().catch(console.error);
    renderMyMatchesList().catch(console.error);
  });

  async function joinMatch(matchId) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    try {
      const { data: m, error: mErr } = await sb.from("matches").select("entry_fee").eq("id", matchId).single();
      if (mErr || !m) throw new Error("Match not found.");

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const decimals = await usdcContract.decimals();
      const amountToLock = ethers.utils.parseUnits(m.entry_fee.toString(), decimals);

      alert(`To join, you need to lock ${m.entry_fee} USDC. Please confirm Approval in your wallet.`);
      const appTx = await usdcContract.approve(ESCROW_ADDRESS, amountToLock);
      await appTx.wait();

      alert("Approval successful! Now confirming entry on the blockchain...");
      const joinTx = await escrowContract.joinMatch(matchId);
      await joinTx.wait();

      const { error } = await sb.from("match_participants").insert({
        match_id: matchId,
        wallet_address: wallet.toLowerCase(),
        role: "opponent"
      });

      if (error) throw error;

      alert("Joined successfully! 🎮 Money is secured in Escrow.");
      
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

    const { data: allParticipants } = await sb
      .from("match_participants")
      .select("wallet_address, role")
      .eq("match_id", m.id);

    const opponent = allParticipants?.find(p => p.role === "opponent");
    const creator = allParticipants?.find(p => p.role === "creator");
    const isFull = allParticipants?.length >= 2;

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

      const cancelBtn = document.getElementById("btn-cancel-match");
      if (cancelBtn) {
        cancelBtn.onclick = () => cancelMatch(m.id);
      }
    }
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

      const { error: uploadErr } = await sb.storage.from("match-proofs").upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: pub } = sb.storage.from("match-proofs").getPublicUrl(filePath);
      const imageUrl = pub?.publicUrl || "";

      const { error: dbErr } = await sb.from("match_proofs").upsert({
        match_id: matchId,
        wallet_address: wallet,
        image_url: imageUrl,
      });
      if (dbErr) throw dbErr;

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

  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "proof-upload") {
        uploadMatchProof().catch(console.error);
    }
});
  async function setMatchOutcome(action) {
    const sb = await getSupabase();
    const wallet = getWallet().toLowerCase();
    const matchId = window.__chainesportCurrentMatchId;

    if (!wallet || !matchId) return alert("No active match found.");

    const confirmMsg = action === 'dispute' 
      ? "Are you sure you want to open a DISPUTE? An admin will review the proofs."
      : `Are you sure you want to claim a ${action.toUpperCase()}? False claims may lead to a permanent ban.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      [btnWon, btnLost, btnDispute].forEach(b => { if(b) b.disabled = true; });

      let newStatus = "in_progress";
      if (action === "dispute") newStatus = "disputed";
      if (action === "won" || action === "lost") newStatus = "locked"; // Locked means waiting for admin/system verification

      const { error: matchErr } = await sb
        .from("matches")
        .update({ status: newStatus })
        .eq("id", matchId);

      if (matchErr) throw matchErr;

      const systemIcon = action === "won" ? "🏆" : (action === "lost" ? "❌" : "⚠️");
      await sb.from("match_messages").insert({
        match_id: matchId,
        sender_wallet: wallet,
        message: `${systemIcon} [SYSTEM] I have claimed a ${action.toUpperCase()}.`,
      });

      alert(`Result ${action.toUpperCase()} has been submitted! ✅`);
      
      await renderMyMatchesList();
      await loadMyOpenMatch();
      await loadChat();

    } catch (err) {
      console.error(err);
      alert("Error saving result: " + err.message);
      [btnWon, btnLost, btnDispute].forEach(b => { if(b) b.disabled = false; });
    }
  }

  btnWon?.addEventListener("click", () => setMatchOutcome("won"));
  btnLost?.addEventListener("click", () => setMatchOutcome("lost"));
  btnDispute?.addEventListener("click", () => setMatchOutcome("dispute"));


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
document.addEventListener("DOMContentLoaded", async () => {
    if (typeof initUIElements === "function") initUIElements();

    if (!window.ethereum) {
        console.warn("No wallet detected on load");
        await refreshPlayerUI();
        return;
    }

    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
            console.log("Wallet detected and connected by default:", accounts[0]);
            window.applyWalletToUI(accounts[0], await window.ethereum.request({ method: "eth_chainId" }));
        } else {
            console.log("No accounts detected.");
            alert("Please connect your wallet to use ChainEsport.");
        }
    } catch (err) {
        console.error("Failed to auto-detect wallet:", err);
        alert("Unable to automatically detect wallet. Please connect manually.");
    }

    await refreshPlayerUI();
});
  async function cancelMatch(matchId) {
    if (!confirm("Are you sure? This will refund your USDC and remove the match.")) return;

    const btn = document.getElementById("btn-cancel-match");
    try {
      if (btn) { btn.disabled = true; btn.textContent = "REFUNDING..."; }

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

      const tx = await escrowContract.cancelMatch(matchId);
      await tx.wait();

      const sb = await getSupabase();
      await sb.from("matches").update({ status: "cancelled" }).eq("id", matchId);

      alert("Match cancelled successfully. Funds have been returned! 💸");
      
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
  window.showTab = showTab;
  window.refreshPlayerUI = refreshPlayerUI;
  window.renderOpenMatches = renderOpenMatches;
  window.renderMyMatchesList = renderMyMatchesList;
  window.loadMyOpenMatch = loadMyOpenMatch;
  window.joinMatch = joinMatch;
  window.connectInjected = connectInjected; 
  window.getWallet = getWallet;
  window.getSupabase = getSupabase;
})();

async function checkNodeRegistry(address) {
    const registeredHolders = [
        "0.your_wallet_address_here", 
        "0.another_address"
    ];
    return registeredHolders.includes(address.toLowerCase());
}
