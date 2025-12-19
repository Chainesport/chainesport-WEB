(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  /* ============================================================
     Tabs
  ============================================================ */
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
      setTimeout(() => {
        unlockTournamentsIfReady().catch(console.error);
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

    unlockTournamentsIfReady().catch(console.error);
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

  const getWallet = () => window.connectedWalletAddress || "";

  /* ============================================================
     Player Registration (gating Create Match)
  ============================================================ */
  const playerForm = byId("playerForm");
  const createMatchBlock = byId("create-match-block");

  async function unlockTournamentsIfReady() {
    const wallet = getWallet();
    if (!wallet) {
      createMatchBlock?.classList.add("hidden");
      return;
    }

    const sb = await getSupabase();
    const { data, error } = await sb
      .from("players")
      .select("wallet_address")
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (error) console.error(error);

    if (data) createMatchBlock?.classList.remove("hidden");
    else createMatchBlock?.classList.add("hidden");
  }

  playerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const sb = await getSupabase();
  const wallet = getWallet();
  if (!wallet) return alert("Connect wallet first");

  const f = new FormData(playerForm);

  const nickname = String(f.get("nickname") || "").trim();
  const email = String(f.get("email") || "").trim().toLowerCase();
  const real_name = String(f.get("real_name") || "").trim();
  const agree = !!byId("agreePlayer")?.checked;

  if (!nickname || !email || !real_name) return alert("Fill nickname, email, real name");
  if (!agree) return alert("Accept rules");

  // IMPORTANT: use INSERT (not upsert) so duplicates are blocked
  const { error } = await sb.from("players").insert({
    wallet_address: wallet.toLowerCase(),
    nickname,
    email,
    real_name
  });

  if (error) {
    // Friendly message for duplicates (wallet/email/nickname already used)
    if (String(error.code) === "23505") {
      return alert("Registration failed: wallet/email/nickname already registered.");
    }
    console.error(error);
    return alert("Registration error: " + error.message);
  }

  alert("Registered ✅");
  unlockTournamentsIfReady();
});


    if (error) {
      console.error(error);
      return alert(error.message);
    }

    alert("Registered ✅");
    await unlockTournamentsIfReady();
  });

  /* ============================================================
     Create Match + Auto Join (creator)
  ============================================================ */
  byId("cm-create")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet");

    const game = String(byId("cm-game")?.value || "").trim();
    const conditions = String(byId("cm-conditions")?.value || "").trim();
    const entry = Number(byId("cm-entry")?.value || 0);

    const date = byId("cm-date") ? String(byId("cm-date").value || "").trim() : "";
    const time = byId("cm-time") ? String(byId("cm-time").value || "").trim() : "";
    const conditionsFull =
      `${conditions}` +
      (date ? ` | Date: ${date}` : "") +
      (time ? ` | Time: ${time}` : "");

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

    // Auto join creator
    const { error: jErr } = await sb.from("match_participants").insert({
      match_id: match.id,
      wallet_address: wallet,
      role: "creator",
      locked_in: false,
    });

    if (jErr) console.error(jErr);

    // Clear inputs
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

    // Insert as opponent (if table requires role, we provide it)
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

    // After loading match, update gating
    await refreshLockGating();
    await refreshProofGating();
  }

  /* ============================================================
     LOCK IN (Disclaimers -> set locked_in flags)
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

    // Show chat/proof only after *I* locked in
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

    // Confirm result stays hidden until proof uploaded (handled separately)
    confirmResultBlock?.classList.add("hidden");
  }

  async function lockInMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();

    if (!wallet || !matchId) return alert("No active match");
    if (!getDisclaimersAccepted()) return alert("Please tick all 3 disclaimers first");

    if (lockStatus) lockStatus.textContent = "Locking in...";

    // 1) Mark me as locked in
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

    // 2) If both players locked in -> update match status to locked
    const { data: parts, error: pErr } = await sb
      .from("match_participants")
      .select("locked_in")
      .eq("match_id", matchId);

    if (pErr) console.error(pErr);

    const bothLocked = (parts || []).length >= 2 && (parts || []).every((p) => p.locked_in);

    if (bothLocked) {
      const { error: mErr } = await sb
        .from("matches")
        .update({ status: "locked" })
        .eq("id", matchId);

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
     Chat (PERMANENT)
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
     Match Proof Upload (IMAGE)
  ============================================================ */
  const proofFile = byId("proof-file");
  const proofBtn = byId("proof-upload");
  const proofStatus = byId("proof-status");

  async function refreshProofGating() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const matchId = getCurrentMatchId();
    if (!wallet || !matchId) return;

    // Only after lock-in we even consider proof/result gating
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

    // If my proof exists -> show confirm result block
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
     Match Result Confirmation (WON / LOST / DISPUTE)
  ============================================================ */
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-result]");
    if (!btn) return;

    const result = btn.dataset.result; // won | lost | dispute
    const wallet = getWallet();
    const matchId = getCurrentMatchId();
    if (!wallet || !matchId) return alert("No active match");

    // Require proof before allowing result (UI should already hide, but hard check too)
    if (confirmResultBlock?.classList.contains("hidden")) {
      return alert("Upload proof first");
    }

    const sb = await getSupabase();

    // Save my result
    const { error } = await sb
      .from("match_participants")
      .update({ result, confirmed: true })
      .eq("match_id", matchId)
      .eq("wallet_address", wallet);

    if (error) {
      console.error(error);
      return alert("Failed to save result: " + error.message);
    }

    // Check both players
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
  // Try to init supabase early
  getSupabase().catch(console.error);

})();
