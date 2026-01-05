(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  /* ============================================================
     KYC (Sumsub) — redirect (NO modal)
  ============================================================ */
  const DISABLE_KYC = true; // ✅ testnet: no KYC

const SUMSUB_KYC_URL = "https://in.sumsub.com/websdk/p/uni_hxgnQ3PWA7q9cuGg";
function goToKyc() {
  if (DISABLE_KYC) return; // ✅ do nothing on testnet
  window.location.href = SUMSUB_KYC_URL;
}


  /* ============================================================
     Tabs
  ============================================================ */
  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  function showTab(tab) {
    if (!panels.includes(tab)) tab = "news";

    panels.forEach((t) => byId("panel-" + t)?.classList.add("hidden"));
    byId("panel-" + tab)?.classList.remove("hidden");

    $$(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add("is-active");

    ["team", "whitepaper", "news", "roadmap", "tournaments"].forEach((s) =>
      byId("side-" + s)?.classList.add("hidden")
    );
    byId("side-" + tab)?.classList.remove("hidden");

    if (location.hash !== "#" + tab) history.replaceState(null, "", "#" + tab);

    if (tab === "tournaments") {
      setTimeout(() => {
        refreshPlayerUI().catch(console.error);
        renderOpenMatches().catch(console.error);
        loadMyOpenMatch().catch(console.error);
        loadChat().catch(console.error);
        refreshLockGating().catch(console.error);
        refreshProofGating().catch(console.error);
      }, 300);
    }
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));

  /* ============================================================
     Wallet (Reown AppKit)
  ============================================================ */
  const walletBtn = byId("walletBtn");

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? String(address).toLowerCase() : "";
    window.connectedWalletAddress = addr;
    window.connectedChainId = chainId ?? null;
    if (walletBtn) walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
  }

  walletBtn?.addEventListener("click", () => {
    if (window.ChainEsportWallet?.open) window.ChainEsportWallet.open();
    else alert("Wallet module not loaded. Refresh the page.");
  });

  window.addEventListener("chainesport:wallet", (ev) => {
    setWalletUI(ev?.detail?.address, ev?.detail?.chainId);

    refreshPlayerUI().catch(console.error);
    renderOpenMatches().catch(console.error);
    loadMyOpenMatch().catch(console.error);
    loadChat().catch(console.error);
    refreshLockGating().catch(console.error);
    refreshProofGating().catch(console.error);
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

  /* ============================================================
     Supabase
  ============================================================ */
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";
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

  /* ============================================================
     Player UI (Registration vs Profile)  ✅ FIXED
  ============================================================ */
  const playerForm = byId("playerForm");
  const playerRegisterBlock = byId("playerRegisterBlock"); // NEW wrapper from index.html
  const playerProfile = byId("playerProfile");             // ✅ FIX (was null before)
  const createMatchBlock = byId("create-match-block");

  async function refreshPlayerUI() {
    const wallet = getWallet();

    // no wallet -> show registration, hide profile + create match
    if (!wallet) {
      playerRegisterBlock?.classList.remove("hidden");
      playerProfile?.classList.add("hidden");
      createMatchBlock?.classList.add("hidden");
      return;
    }

    let p = null;
    try {
      const sb = await getSupabase();
      const res = await sb
        .from("players")
        .select("nickname, games, language, wins, losses, avatar_url, kyc_verified")
        .ilike("wallet_address", wallet)
        .maybeSingle();

      if (!res.error) p = res.data;
    } catch (e) {
      console.warn("Players table not ready yet, continuing in demo mode");
    }

    // not registered -> show registration
    if (!p) {
      playerRegisterBlock?.classList.remove("hidden");
      playerProfile?.classList.add("hidden");
      createMatchBlock?.classList.add("hidden");
      return;
    }

    // registered but not approved (only block on mainnet)
if (!DISABLE_KYC && p.kyc_verified !== true) {
  playerRegisterBlock?.classList.add("hidden");
  playerProfile?.classList.add("hidden");
  createMatchBlock?.classList.add("hidden");
  return;
}


    // approved -> show profile + create match
    playerRegisterBlock?.classList.add("hidden");
    playerProfile?.classList.remove("hidden");
    createMatchBlock?.classList.remove("hidden");

    byId("pp-nickname") && (byId("pp-nickname").textContent = p.nickname || "—");
    byId("pp-games") && (byId("pp-games").textContent = p.games || "—");
    byId("pp-language") && (byId("pp-language").textContent = p.language || "—");

    const wins = Number(p.wins || 0);
    const losses = Number(p.losses || 0);
    byId("pp-wl") && (byId("pp-wl").textContent = `${wins}/${losses}`);
    byId("pp-rating") && (byId("pp-rating").textContent = `${wins} wins / ${losses} losses`);

    const img = byId("pp-avatar");
    if (img) img.src = p.avatar_url || "assets/avatar_placeholder.png";
  }

  /* ============================================================
     Player Registration (save to DB + send email)
  ============================================================ */
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
      wallet_address: wallet,
      nickname,
      email,
      real_name: realName,
      // kyc_verified stays false in DB (default)
    });

    if (error) {
      console.error(error);
      if (error.code === "23505") {
        return alert("This wallet / email / nickname / name is already registered.");
      }
      return alert("Registration error: " + error.message);
    }

    // send email (best effort)
    try {
      const sendData = new FormData();
      sendData.append("access_key", WEB3FORMS_ACCESS_KEY);
      sendData.append("subject", "New Player Registration");
      sendData.append("wallet_address", wallet);
      sendData.append("nickname", nickname);
      sendData.append("email", email);
      sendData.append("real_name", realName);

      await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: sendData,
      });
    } catch (err) {
      console.warn("Email failed (DB saved OK):", err);
    }

    alert("Registered ✅ Now complete KYC");
    goToKyc();
  });

  /* ============================================================
     Player Avatar Upload (Supabase Storage: player-avatars)
  ============================================================ */
  byId("pp-avatar-upload")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const fileInput = byId("pp-avatar-file");
    const status = byId("pp-avatar-status");
    const file = fileInput?.files?.[0];
    if (!file) return alert("Select image first");

    if (status) status.textContent = "Uploading...";

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${wallet}/avatar.${ext}`;

    const { error: upErr } = await sb.storage.from("player-avatars").upload(path, file, { upsert: true });
    if (upErr) {
      console.error(upErr);
      if (status) status.textContent = "";
      return alert("Upload failed: " + upErr.message);
    }

    const { data: pub } = sb.storage.from("player-avatars").getPublicUrl(path);
    const url = pub?.publicUrl || "";

    const { error: dbErr } = await sb
      .from("players")
      .update({ avatar_url: url })
      .eq("wallet_address", wallet);

    if (dbErr) {
      console.error(dbErr);
      if (status) status.textContent = "";
      return alert("Save failed: " + dbErr.message);
    }

    byId("pp-avatar") && (byId("pp-avatar").src = url);
    if (status) status.textContent = "Saved ✅";
  });

  /* ============================================================
     Create Match + Auto Join (creator)
  ============================================================ */
  byId("cm-create")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet");

    const { data: pl } = await sb
      .from("players")
      .select("kyc_verified")
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (!pl?.kyc_verified) {
      alert("KYC required to create matches.");
      return goToKyc();
    }

    const game = String(byId("cm-game")?.value || "").trim();
    const conditions = String(byId("cm-conditions")?.value || "").trim();
    const entry = Number(byId("cm-entry")?.value || 0);

    const date = byId("cm-date") ? String(byId("cm-date").value || "").trim() : "";
    const time = byId("cm-time") ? String(byId("cm-time").value || "").trim() : "";
    const conditionsFull =
      `${conditions}` + (date ? ` | Date: ${date}` : "") + (time ? ` | Time: ${time}` : "");

    if (!game || !conditions || !entry) return alert("Fill Game, Conditions, Entry Fee");

    const { data: match, error } = await sb
      .from("matches")
      .insert({
        creator_wallet: wallet,
        game,
        conditions: conditionsFull,
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
      wallet_address: wallet,
      role: "creator",
      locked_in: false,
    });
    if (jErr) console.error(jErr);

    byId("cm-game") && (byId("cm-game").value = "");
    byId("cm-conditions") && (byId("cm-conditions").value = "");
    byId("cm-entry") && (byId("cm-entry").value = "");
    byId("cm-date") && (byId("cm-date").value = "");
    byId("cm-time") && (byId("cm-time").value = "");

    await renderOpenMatches();
    await loadMyOpenMatch();
    await refreshLockGating();
  });

  /* ============================================================
     Matches List + Join
  ============================================================ */
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
      ? await sb.from("match_participants").select("match_id").eq("wallet_address", wallet)
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

  async function joinMatch(matchId) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const { data: pl } = await sb
      .from("players")
      .select("kyc_verified")
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (!pl?.kyc_verified) {
      alert("KYC required to join matches.");
      return goToKyc();
    }

    const { error } = await sb.from("match_participants").insert({
      match_id: matchId,
      wallet_address: wallet,
      role: "opponent",
      locked_in: false,
    });

    if (error) {
      console.error(error);
      return alert(error.message);
    }

    alert("Joined ✅");
    await renderOpenMatches();
    await loadMyOpenMatch();
    await refreshLockGating();
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (!btn || btn.disabled) return;
    joinMatch(btn.getAttribute("data-join-id")).catch(console.error);
  });

  /* ============================================================
     My Match
  ============================================================ */
  const myMatchBlock = byId("my-match-block");
  const myMatchDetails = byId("my-match-details");

  function getCurrentMatchId() {
    const t = myMatchDetails?.textContent || "";
    const line = t.split("\n").find((l) => l.startsWith("Match ID:"));
    return line ? line.replace("Match ID:", "").trim() : "";
  }

  async function loadMyOpenMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) {
      myMatchBlock?.classList.add("hidden");
      return;
    }

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("match_id")
      .eq("wallet_address", wallet);

    if (pErr) console.error(pErr);

    const ids = (parts || []).map((p) => p.match_id);
    if (!ids.length) {
      myMatchBlock?.classList.add("hidden");
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
      return;
    }

    myMatchBlock?.classList.remove("hidden");
    if (myMatchDetails) {
      myMatchDetails.textContent =
        `Game: ${m.game}\n` +
        `Conditions: ${m.conditions}\n` +
        `Entry: ${m.entry_fee} USDC\n` +
        `Status: ${m.status}\n` +
        `Match ID: ${m.id}`;
    }

    await refreshLockGating();
    await refreshProofGating();
  }

  /* ============================================================
     LOCK IN
  ============================================================ */
  const lockBtn = byId("lock-in-btn");
  const lockStatus = byId("lock-status");
  const chatBlock = byId("chat-block");
  const proofBlock = byId("proof-block");
  const confirmResultBlock = byId("confirm-result");

  function getDisclaimersAccepted() {
    const a1 = byId("agree-match-1")?.checked;
    const a2 = byId("agree-match-2")?.checked;
    const a3 = byId("agree-match-3")?.checked;
    return !!(a1 && a2 && a3);
  }

  async function refreshLockGating() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();
    if (!wallet || !matchId) return;

    const { data: me, error } = await sb
      .from("match_participants")
      .select("locked_in, locked_in_at")
      .eq("match_id", matchId)
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (error) console.error(error);

    const lockedIn = !!me?.locked_in;

    if (lockedIn) {
      chatBlock?.classList.remove("hidden");
      proofBlock?.classList.remove("hidden");
      if (lockBtn) lockBtn.disabled = true;
      if (lockStatus) lockStatus.textContent = "Locked in ✅ Waiting for opponent...";
    } else {
      chatBlock?.classList.add("hidden");
      proofBlock?.classList.add("hidden");
      if (lockBtn) lockBtn.disabled = false;
      if (lockStatus) lockStatus.textContent = "";
    }

    confirmResultBlock?.classList.add("hidden");
  }

  async function lockInMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();

    if (!wallet || !matchId) return alert("No active match");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    if (lockStatus) lockStatus.textContent = "Locking in...";

    const { error } = await sb
      .from("match_participants")
      .update({
        locked_in: true,
        locked_in_at: new Date().toISOString(),
      })
      .eq("match_id", matchId)
      .eq("wallet_address", wallet);

    if (error) {
      console.error(error);
      if (lockStatus) lockStatus.textContent = "";
      return alert("Failed to lock in: " + error.message);
    }

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("locked_in")
      .eq("match_id", matchId);

    if (pErr) console.error(pErr);

    const bothLocked = (parts || []).length >= 2 && (parts || []).every((p) => p.locked_in);

    if (bothLocked) {
      const { error: mErr } = await sb.from("matches").update({ status: "locked" }).eq("id", matchId);
      if (mErr) console.error(mErr);
      if (lockStatus) lockStatus.textContent = "Both locked in ✅ Match is LOCKED.";
    } else {
      if (lockStatus) lockStatus.textContent = "Locked in ✅ Waiting for opponent...";
    }

    await loadMyOpenMatch();
    await refreshLockGating();
  }

  lockBtn?.addEventListener("click", () => {
    lockInMatch().catch(console.error);
  });

  /* ============================================================
     Chat
  ============================================================ */
  const chatSend = byId("chat-send");
  const chatText = byId("chat-text");
  const chatBox = byId("chat-messages");

  async function loadChat() {
    const sb = await getSupabase();
    const matchId = getCurrentMatchId();
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
  }

  chatSend?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const msg = String(chatText?.value || "").trim();
    const matchId = getCurrentMatchId();
    const wallet = getWallet();

    if (!msg) return;
    if (!wallet || !matchId) return alert("No active match");
    if (chatBlock?.classList.contains("hidden")) return alert("Lock in first");

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

  /* ============================================================
     Match Proof Upload
  ============================================================ */
  const proofFile = byId("proof-file");
  const proofBtn = byId("proof-upload");
  const proofStatus = byId("proof-status");

  async function refreshProofGating() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();
    if (!wallet || !matchId) return;

    const { data: me } = await sb
      .from("match_participants")
      .select("locked_in")
      .eq("match_id", matchId)
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (!me?.locked_in) {
      confirmResultBlock?.classList.add("hidden");
      return;
    }

    const { data: proof } = await sb
      .from("match_proofs")
      .select("id")
      .eq("match_id", matchId)
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (proof?.id) confirmResultBlock?.classList.remove("hidden");
    else confirmResultBlock?.classList.add("hidden");
  }

  async function uploadMatchProof() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();

    if (!wallet || !matchId) return alert("No active match");
    if (proofBlock?.classList.contains("hidden")) return alert("Lock in first");
    if (!proofFile?.files?.length) return alert("Select an image");

    const file = proofFile.files[0];
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const filePath = `${matchId}/${wallet}.${ext}`;

    if (proofStatus) proofStatus.textContent = "Uploading proof...";

    const { error: uploadErr } = await sb.storage
      .from("match-proofs")
      .upload(filePath, file, { upsert: true });

    if (uploadErr) {
      console.error(uploadErr);
      if (proofStatus) proofStatus.textContent = "";
      return alert("Upload failed: " + uploadErr.message);
    }

    const { data: pub } = sb.storage.from("match-proofs").getPublicUrl(filePath);
    const imageUrl = pub?.publicUrl || "";

    const { error: dbErr } = await sb.from("match_proofs").upsert({
      match_id: matchId,
      wallet_address: wallet,
      image_url: imageUrl,
    });

    if (dbErr) {
      console.error(dbErr);
      if (proofStatus) proofStatus.textContent = "";
      return alert("Database error: " + dbErr.message);
    }

    if (proofStatus) proofStatus.textContent = "Proof uploaded ✅";
    await refreshProofGating();
  }

  proofBtn?.addEventListener("click", () => {
    uploadMatchProof().catch(console.error);
  });

  /* ============================================================
     Match Result Confirmation
  ============================================================ */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-result]");
    if (!btn) return;

    const result = btn.dataset.result;
    const wallet = getWallet();
    const matchId = getCurrentMatchId();
    if (!wallet || !matchId) return alert("No active match");

    if (confirmResultBlock?.classList.contains("hidden")) {
      return alert("Upload proof first");
    }

    const sb = await getSupabase();

    const { error } = await sb
      .from("match_participants")
      .update({ result, confirmed: true })
      .eq("match_id", matchId)
      .eq("wallet_address", wallet);

    if (error) {
      console.error(error);
      return alert("Failed to save result: " + error.message);
    }

    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("result, confirmed")
      .eq("match_id", matchId);

    if (pErr) console.error(pErr);

    if (!parts || parts.length < 2) {
      alert("Result saved. Waiting for opponent.");
      return;
    }

    const results = parts.map((p) => p.result);

    let newStatus = "locked";
    if (results.includes("dispute")) newStatus = "disputed";
    else if (results.includes("won") && results.includes("lost")) newStatus = "finished";

    const { error: mErr } = await sb.from("matches").update({ status: newStatus }).eq("id", matchId);
    if (mErr) console.error(mErr);

    alert(`Match status: ${newStatus.toUpperCase()}`);
    await loadMyOpenMatch();
  });

  /* ============================================================
     Boot
  ============================================================ */
  getSupabase().catch(console.error);
})();