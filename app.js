(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  // ============================================================
  // Tabs
  // ============================================================
  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  function showTab(tab) {
    panels.forEach((t) => byId("panel-" + t)?.classList.add("hidden"));
    byId("panel-" + tab)?.classList.remove("hidden");

    $$(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add("is-active");

    ["team", "whitepaper", "news", "roadmap", "tournaments"].forEach((s) =>
      byId("side-" + s)?.classList.add("hidden")
    );
    byId("side-" + tab)?.classList.remove("hidden");

    location.hash = tab;

    if (tab === "tournaments") {
      setTimeout(renderOpenMatches, 300);
    }
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));

  // ============================================================
  // Wallet connect (Reown AppKit)
  // ============================================================
  let walletConnected = false;

  const walletBtn = byId("walletBtn");
  const walletModal = byId("walletModal");
  const walletClose = byId("walletClose");

  function shortAddr(a) {
    if (!a) return "";
    const s = String(a);
    return s.slice(0, 6) + "…" + s.slice(-4);
  }

  function setWalletUI(address, chainId) {
    const addr = address ? String(address) : "";

    walletConnected = !!addr;
    window.connectedWalletAddress = addr ? addr.toLowerCase() : "";
    window.connectedChainId = chainId ?? null;

    if (walletBtn) {
      walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
    }

    // keep legacy modal hidden
    walletModal?.classList.add("hidden");
  }

  // Hide legacy modal forever
  walletModal?.classList.add("hidden");
  walletClose?.addEventListener("click", () => walletModal?.classList.add("hidden"));
  walletModal?.addEventListener("click", (e) => {
    if (e.target === walletModal) walletModal.classList.add("hidden");
  });

  // Wallet button opens AppKit
  walletBtn?.addEventListener("click", () => {
    if (window.ChainEsportWallet?.open) {
      window.ChainEsportWallet.open();
    } else {
      console.error("ChainEsportWallet is missing. wallet.bundle.js not loaded?");
      alert("Wallet module not loaded. Please refresh and try again.");
    }
  });

  // Receive wallet events from wallet.bundle.js
  window.addEventListener("chainesport:wallet", (ev) => {
    const { address = null, chainId = null } = ev?.detail || {};
    setWalletUI(address, chainId);

    if (address && location.hash === "#node-login") {
      nlShowAuthed(address);
    }

    if (address) renderOpenMatches();
  });

  // ============================================================
  // Node Dashboard (demo)
  // ============================================================
  const nlGuest = byId("nl-guest");
  const nlAuthed = byId("nl-authed");
  const nlAddress = byId("nl-address");

  async function nlShowAuthed(addr) {
    nlGuest?.classList.add("hidden");
    nlAuthed?.classList.remove("hidden");
    if (nlAddress) nlAddress.textContent = addr;
  }

  // ============================================================
  // Supabase
  // ============================================================
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";
  let sbClient = null;

  async function getSupabase() {
    if (sbClient) return sbClient;

    if (!window.supabase?.createClient) {
      await new Promise((res) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = res;
        document.head.appendChild(s);
      });
    }

    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.sb = sbClient; // debug
    return sbClient;
  }

  getSupabase().catch(console.error);

  function getWallet() {
    return window.connectedWalletAddress || "";
  }

  // ============================================================
  // Matches
  // ============================================================
  async function renderOpenMatches() {
    const sb = await getSupabase();
    if (!sb) return;

    const list = byId("matches-list");
    if (!list) return;

    const { data, error } = await sb.from("matches").select("*").eq("status", "open");

    if (error) {
      console.error(error);
      list.innerHTML = `<div class="text-sm text-muted">Error loading matches: ${error.message}</div>`;
      return;
    }

    list.innerHTML = "";

    const matches = data || [];
    if (!matches.length) {
      list.innerHTML = `<div class="text-sm text-muted">No open matches yet.</div>`;
      return;
    }

    matches.forEach((m, i) => {
      const card = document.createElement("div");
      card.className = "card-2 p-4";
      card.innerHTML = `
        <b>${i + 1}. ${m.game}</b><br/>
        Entry: ${m.entry_fee} USDC<br/>
        <button class="btn" data-join-id="${m.id}" type="button">JOIN</button>
      `;
      list.appendChild(card);
    });
  }

  async function joinMatch(id) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const { error } = await sb.from("match_participants").insert({
      match_id: id,
      wallet_address: wallet,
    });

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    alert("Joined");
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (btn) joinMatch(btn.getAttribute("data-join-id"));
  });

  // ============================================================
  // Initial wallet UI sync
  // ============================================================
  function syncWalletFromAppKit() {
    const addr = window.ChainEsportWallet?.getAddress?.() || null;
    const cid = window.ChainEsportWallet?.getChainId?.() || null;
    setWalletUI(addr, cid);
  }

  // 1) Try once immediately
  syncWalletFromAppKit();

  // 2) Retry a few times (wallet.bundle can load slightly later)
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    syncWalletFromAppKit();
    if (window.connectedWalletAddress || tries >= 20) clearInterval(t);
  }, 250);

  // ============================================================
// Player Registration (WORKING)
// ============================================================
const playerForm = byId("playerForm");
const createMatchBlock = byId("create-match-block");

async function isPlayerRegistered(wallet) {
  const sb = await getSupabase();
  const { data, error } = await sb.from("players").select("wallet_address").eq("wallet_address", wallet).maybeSingle();
  if (error) {
    console.error(error);
    return false;
  }
  return !!data;
}

async function unlockTournamentsIfReady() {
  const wallet = getWallet();
  if (!wallet) return;

  const registered = await isPlayerRegistered(wallet);
  if (registered) {
    createMatchBlock?.classList.remove("hidden");
  } else {
    createMatchBlock?.classList.add("hidden");
  }
}

// On wallet connect -> check gating
window.addEventListener("chainesport:wallet", () => {
  unlockTournamentsIfReady().catch(console.error);
});

// On page load -> check gating (if already connected)
setTimeout(() => unlockTournamentsIfReady().catch(console.error), 500);

playerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const wallet = getWallet();
  if (!wallet) return alert("Connect wallet first");

  const form = new FormData(playerForm);
  const nickname = String(form.get("nickname") || "").trim();
  const email = String(form.get("email") || "").trim();
  const agree = byId("agreePlayer")?.checked;

  if (!nickname || !email) return alert("Fill nickname and email");
  if (!agree) return alert("Please accept the disclaimer checkbox");

  const sb = await getSupabase();

  const { error } = await sb.from("players").upsert({
    wallet_address: wallet,
    nickname,
    email
  });

  if (error) {
    console.error(error);
    return alert("Registration error: " + error.message);
  }

  alert("Registered ✅");
  await unlockTournamentsIfReady();
  
});

})();
