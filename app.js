/* ============================================================
   LOGIN / WALLET PATCH (FIXED)
   - Login opens wallet modal
   - MetaMask connects (injected)
   - Updates #walletBtn label
   - Fills #playerWalletDisplay + web3forms hidden fields
   - Emits: window.dispatchEvent("chainesport:wallet")
   NOTE: WalletConnect needs wallet.bundle.js (disabled otherwise)
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

    // expose wallet API for MAIN APP
    window.ChainEsportWallet = {
      open: () => openModal(walletModal),          // open modal (not direct connect)
      openNetworks: () => openModal(walletModal),
      getAddress: () => connectedAddress,
      getChainId: () => connectedChainId,
    };

    // notify MAIN APP
    dispatchWallet(addr, chainId);
  }

  async function connectInjected() {
    if (!window.ethereum) {
      alert("No browser wallet detected. Please install MetaMask (or use a Web3 browser).");
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts && accounts[0] ? accounts[0] : null;
      const chainId = await window.ethereum.request({ method: "eth_chainId" });

      applyWalletToUI(addr, chainId);

      closeModal(walletModal);
      openModal(postConnectModal);
    } catch (e) {
      console.error("connectInjected error:", e);
      alert("Wallet connection cancelled or failed.");
    }
  }

  function wireWalletModalButtons() {
    if (!walletModal) return;

    // Your HTML buttons are plain text: "WalletConnect" and "MetaMask"
    const buttons = $$("button", walletModal);

    const mmBtn = buttons.find((b) =>
      String(b.textContent || "").toLowerCase().includes("metamask")
    );
    const wcBtn = buttons.find((b) =>
      String(b.textContent || "").toLowerCase().includes("walletconnect")
    );

    mmBtn?.addEventListener("click", connectInjected);

    wcBtn?.addEventListener("click", () => {
      alert("WalletConnect is disabled because wallet.bundle.js is commented out.");
    });
  }

  if (!walletBtn) return;

// ✅ prevent double-wiring if this runs more than once
if (walletBtn.dataset.wired === "1") return;
walletBtn.dataset.wired = "1";

    // Ensure wallet API exists even before connection
    if (!window.ChainEsportWallet) {
      window.ChainEsportWallet = {
        open: () => openModal(walletModal),
        openNetworks: () => openModal(walletModal),
        getAddress: () => connectedAddress,
        getChainId: () => connectedChainId,
      };
    }

    // Login button -> always opens the wallet modal (or post-connect if already connected)
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

    // restore session if already connected
    if (window.ethereum) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then(async (acc) => {
          if (acc && acc[0]) {
            const cid = await window.ethereum.request({ method: "eth_chainId" });
            applyWalletToUI(acc[0], cid);
          }
        })
        .catch(() => {});
    }

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

 // ✅ run now (defer scripts usually have DOM ready), AND also run on DOMContentLoaded
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

  const getWallet = () => window.connectedWalletAddress || "";

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

  // Create Match
  byId("cm-create")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    const { data: pl } = await sb
      .from("players")
      .select("kyc_verified")
      .eq("wallet_address", String(wallet || "").toLowerCase())
      .maybeSingle();

    if (!DISABLE_KYC && !pl?.kyc_verified) {
      alert("KYC required to create matches.");
      return goToKyc();
    }

    const game = String(byId("cm-game")?.value || "").trim();
    const conditions = String(byId("cm-conditions")?.value || "").trim();
    const entry = Number(byId("cm-entry")?.value || 0);

    if (!game || !conditions || !entry) return alert("Fill Game, Conditions, Entry Fee");

    const { data: match, error } = await sb
      .from("matches")
      .insert({
        creator_wallet: wallet,
        game,
        conditions,
        entry_fee: entry,
        status: "open",
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    const { error: jErr } = await sb.from("match_participants").insert({
      match_id: match.id,
      wallet_address: String(wallet || "").toLowerCase(),
      role: "creator",
      locked_in: false,
    });
    if (jErr) console.error(jErr);

    byId("cm-game") && (byId("cm-game").value = "");
    byId("cm-conditions") && (byId("cm-conditions").value = "");
    byId("cm-entry") && (byId("cm-entry").value = "");

    await renderOpenMatches();
    await renderMyMatchesList();
    await loadMyOpenMatch();
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

    const { data: parts, error: pErr } = wallet
      ? await sb
          .from("match_participants")
          .select("match_id")
          .eq("wallet_address", String(wallet || "").toLowerCase())
      : { data: [], error: null };

    if (pErr) console.error(pErr);

    const joined = new Set((parts || []).map((p) => p.match_id));

    list.innerHTML = "";
    if (!matches || !matches.length) {
      list.innerHTML = `<div class="text-sm text-muted">No open matches yet.</div>`;
      return;
    }

    matches.forEach((m, i) => {
      const disabled = joined.has(m.id);

      const div = document.createElement("div");
      div.className = "card-2 p-4";

      div.innerHTML = `
        <b>${i + 1}. ${m.game}</b><br/>
        ${m.conditions || ""}<br/>
        Entry: ${m.entry_fee} USDC<br/>
        <button class="btn" data-join-id="${m.id}" ${disabled ? "disabled" : ""}>
          ${disabled ? "JOINED" : "JOIN"}
        </button>
      `;

      list.appendChild(div);
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

  // Join match
  async function joinMatch(matchId) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    const { data: pl } = await sb
      .from("players")
      .select("kyc_verified")
      .eq("wallet_address", String(wallet || "").toLowerCase())
      .maybeSingle();

    if (!DISABLE_KYC && !pl?.kyc_verified) {
      alert("KYC required to join matches.");
      return goToKyc();
    }

    const { error } = await sb.from("match_participants").insert({
      match_id: matchId,
      wallet_address: String(wallet || "").toLowerCase(),
      role: "opponent",
      locked_in: false,
    });

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    alert("Joined ✅");
    await renderOpenMatches();
    await renderMyMatchesList();
    await loadMyOpenMatch();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (!btn || btn.disabled) return;
    joinMatch(btn.getAttribute("data-join-id")).catch(console.error);
  });

  // My Match (status + gating)
  async function loadMyOpenMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();

    // If player profile is hidden => keep My Match hidden
    if (playerProfile?.classList.contains("hidden")) {
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    if (!wallet) {
      myMatchBlock?.classList.add("hidden");
      myMatchDetails && (myMatchDetails.textContent = "—");
      myPlayersBox?.classList.add("hidden");
      chatBlock?.classList.add("hidden");
      proofBlock?.classList.add("hidden");
      confirmResultBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("match_id")
      .eq("wallet_address", String(wallet || "").toLowerCase());

    if (pErr) console.error(pErr);

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
      .in("status", ["open", "locked", "disputed", "finished"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (mErr) console.error(mErr);

    const m = matches?.[0];
    if (!m) {
      myMatchBlock?.classList.add("hidden");
      stopChatAutoRefresh();
      return;
    }

    window.__chainesportCurrentMatchId = String(m.id);

    const { data: myPart } = await sb
      .from("match_participants")
      .select("role")
      .eq("match_id", m.id)
      .eq("wallet_address", String(wallet || "").toLowerCase())
      .maybeSingle();

    const statusNice = myPart?.role === "creator" ? "Open" : "Joined";

    myMatchBlock?.classList.remove("hidden");
    if (myMatchDetails) {
      myMatchDetails.textContent = `Game: ${m.game}\nEntry: ${m.entry_fee} USDC\nStatus: ${statusNice}`;
    }

    const { data: parts2 } = await sb
      .from("match_participants")
      .select("wallet_address, role")
      .eq("match_id", m.id);

    const bothJoined = (parts2 || []).length >= 2;

    if (myPlayersBox) {
      if (bothJoined) {
        const lines = (parts2 || []).map((p) => {
          const w = String(p.wallet_address || "");
          const short = w ? w.slice(0, 6) + "…" + w.slice(-4) : "—";
          return `${p.role}: ${short}`;
        });
        myPlayersBox.textContent = lines.join("\n");
        myPlayersBox.classList.remove("hidden");
      } else {
        myPlayersBox.classList.add("hidden");
      }
    }

    if (chatBlock) bothJoined ? chatBlock.classList.remove("hidden") : chatBlock.classList.add("hidden");
    if (proofBlock) bothJoined ? proofBlock.classList.remove("hidden") : proofBlock.classList.add("hidden");
    if (confirmResultBlock) bothJoined ? confirmResultBlock.classList.remove("hidden") : confirmResultBlock.classList.add("hidden");

    if (bothJoined) {
      await loadChat();
      startChatAutoRefresh();
    } else {
      stopChatAutoRefresh();
    }
  }

  // Chat
  async function loadChat() {
    const sb = await getSupabase();
    const matchId = window.__chainesportCurrentMatchId;
    if (!matchId || !chatBox) return;

    const { data, error } = await sb
      .from("match_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    if (error) console.error(error);

    chatBox.innerHTML = "";
    (data || []).forEach((m) => {
      const from = (m.sender_wallet || "").slice(0, 6) + "…";
      const div = document.createElement("div");
      div.className = "mb-1";
      div.textContent = `${from}: ${m.message}`;
      chatBox.appendChild(div);
    });

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  chatSend?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const msg = String(chatText?.value || "").trim();
    const matchId = window.__chainesportCurrentMatchId;
    const wallet = getWallet();

    if (!msg) return;
    if (!wallet || !matchId) return alert("No active match");
    if (chatBlock?.classList.contains("hidden")) return alert("Wait until opponent joins the match");

    const { error } = await sb.from("match_messages").insert({
      match_id: matchId,
      sender_wallet: wallet,
      message: msg,
    });

    if (error) {
      console.error(error);
      return alert("Failed to send: " + error.message);
    }

    if (chatText) chatText.value = "";
    await loadChat();
  });

  // Proof upload
  async function uploadMatchProof() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = window.__chainesportCurrentMatchId;

    if (!wallet || !matchId) return alert("No active match");
    if (proofBlock?.classList.contains("hidden")) return alert("Wait until opponent joins the match");
    if (!proofFile?.files?.length) return alert("Select an image");

    const file = proofFile.files[0];
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const filePath = `${matchId}/${String(wallet || "").toLowerCase()}.${ext}`;

    if (proofStatus) proofStatus.textContent = "Uploading proof...";

    const { error: uploadErr } = await sb.storage.from("match-proofs").upload(filePath, file, { upsert: true });
    if (uploadErr) {
      console.error(uploadErr);
      if (proofStatus) proofStatus.textContent = "";
      return alert("Upload failed: " + uploadErr.message);
    }

    const { data: pub } = sb.storage.from("match-proofs").getPublicUrl(filePath);
    const imageUrl = pub?.publicUrl || "";

    const { error: dbErr } = await sb.from("match_proofs").upsert({
      match_id: matchId,
      wallet_address: String(wallet || "").toLowerCase(),
      image_url: imageUrl,
    });

    if (dbErr) {
      console.error(dbErr);
      if (proofStatus) proofStatus.textContent = "";
      return alert("Database error: " + dbErr.message);
    }

    if (proofStatus) proofStatus.textContent = "Proof uploaded ✅";
  }

  proofBtn?.addEventListener("click", () => uploadMatchProof().catch(console.error));

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
})();
