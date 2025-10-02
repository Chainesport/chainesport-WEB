(function(){
  const $ = (s,p=document)=>p.querySelector(s);
  const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
  const year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  const panels = ['news','tournaments','whitepaper','roadmap','team','contacts','node-login'];
  function show(tab){
    panels.forEach(t => $('#panel-'+t)?.classList.add('hidden'));
    $('#panel-'+tab)?.classList.remove('hidden');
    $$('.tab-btn').forEach(b=>b.classList.remove('is-active'));
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add('is-active');
    // sidebars visibility
    $('#side-team')?.classList.add('hidden');
    $('#side-whitepaper')?.classList.add('hidden');
    $('#side-news')?.classList?.add('hidden');
    $('#side-roadmap')?.classList?.add('hidden');
    $('#side-tournaments')?.classList?.add('hidden');
    if (tab==='team') $('#side-team')?.classList.remove('hidden');
    if (tab==='whitepaper') $('#side-whitepaper')?.classList.remove('hidden');
    if (tab==='news') $('#side-news')?.classList.remove('hidden');
    if (tab==='roadmap') $('#side-roadmap')?.classList.remove('hidden');
    if (tab==='tournaments') $('#side-tournaments')?.classList.remove('hidden');
    location.hash = tab;
  }
  $$('.tab-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  window.addEventListener('hashchange', () => show((location.hash || '#news').slice(1)));
  show((location.hash || '#news').slice(1));

  // Wallet modal demo
  let walletConnected = false;
  const walletBtn = $('#walletBtn');
  const walletModal = $('#walletModal');
  const walletClose = $('#walletClose');
  walletBtn?.addEventListener('click', ()=> walletModal.classList.remove('hidden'));
  walletClose?.addEventListener('click', ()=> walletModal.classList.add('hidden'));
  walletModal?.addEventListener('click', (e)=>{ if(e.target===walletModal) walletModal.classList.add('hidden') });

  // Post-connect choice modal
  const postConnectModal = $('#postConnectModal');
  const choosePlayer = $('#choosePlayer');
  const chooseNode = $('#chooseNode');
  const postConnectClose = $('#postConnectClose');
  function openPostConnectChoice(){ postConnectModal?.classList.remove('hidden'); }
  postConnectClose?.addEventListener('click', ()=> postConnectModal?.classList.add('hidden'));
  choosePlayer?.addEventListener('click', ()=>{ postConnectModal?.classList.add('hidden'); show('tournaments'); const reg=$('#side-tournaments')||$('#panel-tournaments'); reg?.scrollIntoView({behavior:'smooth',block:'start'}); });
  chooseNode?.addEventListener('click', ()=>{ postConnectModal?.classList.add('hidden'); show('node-login'); $('#nl-connect')?.click(); });

  // Node Dashboard mock data (replace with on-chain calls later)
  const nlGuest=$('#nl-guest'), nlAuthed=$('#nl-authed'), nlConnect=$('#nl-connect'), nlAddress=$('#nl-address');
  const nlNodesOwned=$('#nl-nodes-owned'), nlClaimable=$('#nl-claimable'), nlMonthly=$('#nl-monthly'), nlAlltime=$('#nl-alltime');
  const nlNodeRows=$('#nl-node-rows'), nlPayoutRows=$('#nl-payout-rows'), nlClaimBtn=$('#nl-claim-btn');
  const fmt6=v=>(Number(v||0)/1e6).toFixed(2);

  async function getInvestorDataMock(addr){
    return {
      address: addr,
      nodesOwned: 1,
      claimableUSDC: 4916000000, // 4916.00
      monthUSDC: 2458000000,     // 2458.00
      nodes: [{ id: 101, active: true, uptimePct: 99.2 }], // always Active
      payouts: [
        { period: '2026-03', amount: 3000000000, tx: '0xaaaa...' },
        { period: '2026-04', amount: 3500000000, tx: '0xbbbb...' }
      ],
      allTimeOverrideUSDC: 6500000000 // 6500.00
    };
  }

  async function nlShowAuthed(addr){
    nlGuest?.classList.add('hidden'); nlAuthed?.classList.remove('hidden');
    nlAddress && (nlAddress.textContent = addr);
    const d = await getInvestorDataMock(addr);

    nlNodesOwned && (nlNodesOwned.textContent = (d.nodesOwned||0).toString());
    nlClaimable && (nlClaimable.textContent = fmt6(d.claimableUSDC));
    nlMonthly && (nlMonthly.textContent = fmt6(d.monthUSDC));

    // Use fixed all-time = 6500.00 USDC as requested
    nlAlltime && (nlAlltime.textContent = `All-time: ${fmt6(d.allTimeOverrideUSDC)} USDC`);

    // Nodes
    if (nlNodeRows){
      nlNodeRows.innerHTML='';
      (d.nodes||[]).forEach(n=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td class="py-2 pr-4">${n.id}</td>
                      <td class="py-2 pr-4">Active</td>
                      <td class="py-2 pr-4">${Number(n.uptimePct||0).toFixed(1)}%</td>`;
        nlNodeRows.appendChild(tr);
      });
    }

    // Payouts
    if (nlPayoutRows){
      nlPayoutRows.innerHTML='';
      (d.payouts||[]).forEach(p=>{
        const tx = p.tx ? `<a class="link" target="_blank" rel="noopener" href="https://bscscan.com/tx/${p.tx}">View</a>` : '—';
        const tr=document.createElement('tr');
        tr.innerHTML=`<td class="py-2 pr-4">${p.period}</td>
                      <td class="py-2 pr-4">${fmt6(p.amount)}</td>
                      <td class="py-2 pr-4">${tx}</td>`;
        nlPayoutRows.appendChild(tr);
      });
    }

    // Claim (demo)
    if (nlClaimBtn){
      nlClaimBtn.removeAttribute('disabled');
      nlClaimBtn.onclick=()=>alert('Demo: this would call claim() on your BNB smart contract.');
    }
  }

  // Demo connect inside Node login panel
  nlConnect?.addEventListener('click', async ()=>{
    const demo='0xDEMO000000000000000000000000000000000001';
    alert('Wallet connected (demo).');
    await nlShowAuthed(demo);
  });

  $$('[data-demo]').forEach(b=> b.addEventListener('click', ()=>{ walletConnected=true; walletModal.classList.add('hidden'); alert('Wallet connected (demo).'); }));

  // Gate chats
  function gateJoin(sel, chatId){
    const btn = $(`[data-join="${sel}"]`); const chat = $('#chat-'+chatId);
    btn?.addEventListener('click', ()=> {
      if(!walletConnected){ alert('Connect wallet first (demo).'); return; }
      chat?.classList.remove('hidden');
    });
  }
  gateJoin('fifa','fifa'); gateJoin('mk','mk');

  // Forms demo
  const nodeForm = $('#nodeForm');
  nodeForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = nodeForm?.email?.value?.trim();
    const agree = $('#agreeDisclaimer')?.checked;
    const conf = $('#confirmEligibility')?.checked;
    if(!email){ alert('Please enter your email'); return; }
    if(!agree || !conf){ alert('Please accept the disclaimer and eligibility confirmation'); return; }
    alert('Thank you! We will contact you shortly.');
  });

  const playerForm = $('#playerForm');
  playerForm?.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!$('#agreePlayer')?.checked){ alert('Please agree to the Player Disclaimer'); return; }
    alert('Registered (demo).');
  });
})();

  // Extra node forms in News and Roadmap sidebars
  const nodeFormNews = $('#nodeFormNews');
  nodeFormNews?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = nodeFormNews.querySelector('input[name="email"]')?.value;
    const agree = $('#agreeDisclaimer')?.checked;
    const conf = $('#confirmEligible')?.checked;
    if(!email){ alert('Please enter your email'); return; }
    if(!agree || !conf){ alert('Please accept the disclaimer and eligibility confirmation'); return; }
    alert('Thank you! We will contact you shortly.');
  });
  const nodeFormRoadmap = $('#nodeFormRoadmap');
  nodeFormRoadmap?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const email = nodeFormRoadmap.querySelector('input[name="email"]')?.value;
    const agree = $('#agreeDisclaimer')?.checked;
    const conf = $('#confirmEligible')?.checked;
    if(!email){ alert('Please enter your email'); return; }
    if(!agree || !conf){ alert('Please accept the disclaimer and eligibility confirmation'); return; }
    alert('Thank you! We will contact you shortly.');
  });
