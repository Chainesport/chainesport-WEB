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

 // ----------------------------
// Wallet connect (Reown AppKit)
// ----------------------------
let walletConnected = false;

const walletBtn = byId("walletBtn");  
const walletModal = byId("walletModal");
const walletClose = byId("walletClose");

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? String(address) : "";

    walletConnected = !!addr;
    window.connectedWalletAddress = addr ? addr.toLowerCase() : "";
    window.connectedChainId = chainId ?? null;

    if (walletBtn) {
      walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
    }

    walletModal?.classList.add("hidden");
  }

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
  const nlGuest = byId("nl-guest"),
    nlAuthed = byId("nl-authed"),
    nlAddress = byId("nl-address");

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
    window.sb = sbClient;
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

    const { data } = await sb.from("matches").select("*").eq("status", "open");
    list.innerHTML = "";

    (data || []).forEach((m, i) => {
      const card = document.createElement("div");
      card.className = "card-2 p-4";
      card.innerHTML = `
        <b>${i + 1}. ${m.game}</b><br/>
        Entry: ${m.entry_fee} USDC<br/>
        <button class="btn" data-join-id="${m.id}">JOIN</button>
      `;
      list.appendChild(card);
    });
  }

  async function joinMatch(id) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    await sb.from("match_participants").insert({
      match_id: id,
      wallet_address: wallet,
    });

    alert("Joined");
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (btn) joinMatch(btn.dataset.joinId);
  });

  // ============================================================
  // DOM READY
  // ============================================================
  document.addEventListener("DOMContentLoaded", () => {
    walletBtn = byId("walletBtn");

    if (walletBtn) {
      walletBtn.addEventListener("click", () => {
        if (window.ChainEsportWallet?.open) {
          window.ChainEsportWallet.open();
        } else {
          alert("Wallet not loaded");
        }
      });
    }

    setWalletUI(
      window.ChainEsportWallet?.getAddress?.() || null,
      window.ChainEsportWallet?.getChainId?.() || null
    );
  });
})();
