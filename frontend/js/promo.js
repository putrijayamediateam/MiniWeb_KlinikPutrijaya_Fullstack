// Promo landing page (/promo): renders packages and branch cards from controlled constants; all text is escaped.
(function(){
  var I = {
    wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z"/></svg>',
    call:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    map:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    waze:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>'
  };

  var branches = [
    {id:'cheras', name:'Cheras', full:'Klinik Putrijaya Cheras', img:'/images/promo/branch-cheras.jpg',
     addr:'No. 19 G, Jalan Dwitasik 1, Dataran Dwitasik, 56000 Cheras, Kuala Lumpur',
     open:8, close:23, hours:'8:00am – 11:00pm daily', phone:'018-314 4588',
     note:'Detail / anomaly scan available at this branch'},
    {id:'sgbesi', name:'Sungai Besi', full:'Klinik Putrijaya Sungai Besi', img:'/images/promo/branch-sungai-besi.jpg',
     addr:'Medan Niaga Tasik Damai, 71, Jalan Tasik Utama 6, Sungai Besi, 57000 Kuala Lumpur',
     open:8, close:22, hours:'8:00am – 10:00pm daily', phone:'019-347 0448'},
    {id:'puchong', name:'Puchong', full:'Klinik Putrijaya Puchong', img:'/images/promo/branch-puchong.jpg',
     addr:'13, Jalan PU 13/2, Taman Puchong Utama, 47140 Puchong, Selangor',
     open:8, close:22, hours:'8:00am – 10:00pm daily', phone:'019-387 0448'}
  ];
  function intl(p){ return '60' + p.replace(/\D/g,'').replace(/^0/,''); }
  function wa(b, msg){ return 'https://wa.me/' + intl(b.phone) + '?text=' + encodeURIComponent(msg); }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  // Malaysia time (UTC+8), independent of the viewer's device zone
  function myt(){ var d=new Date(); return new Date(d.getTime() + d.getTimezoneOffset()*60000 + 8*3600000); }

  var plans = [
    {name:'Basic', price:99, for:'Essential health and mental wellness check.',
     head:'Includes', items:[['Doctor consultation'],['Basic physical examination'],['Blood pressure'],['Pulse'],['Weight, height & BMI'],['InBody screening',1],['Full Blood Count (FBC)'],['Fasting Blood Sugar (FBS)'],['DASS-21 screening',1]]},
    {name:'Silver', price:159, for:'Adds cholesterol, kidney and liver tests.',
     head:'Everything in Basic, plus', items:[['Lipid profile (cholesterol)'],['Renal profile (kidney function)'],['Liver function test']]},
    {name:'Premium', price:239, feature:true, badge:'Most complete', for:'Our most thorough screening, with ECG.',
     head:'Everything in Silver, plus', items:[['Full physical examination',0,'upgraded from basic'],['HbA1c (diabetes)'],['Urine FEME (urine test)'],['ECG (electrocardiogram)',1,'Premium only']]}
  ];

  document.getElementById('plans').innerHTML = plans.map(function(p){
    var li = p.items.map(function(it){
      var extra = it[2] ? '<span class="only">' + esc(it[2]) + '</span>' : '';
      return '<li' + (it[1] ? ' class="hl"' : '') + '><span>' + esc(it[0]) + extra + '</span></li>';
    }).join('');
    var book = branches.map(function(b){
      return '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + wa(b, 'Hi Klinik Putrijaya ' + b.name + ', I would like to book the ' + p.name + ' health screening package (RM' + p.price + ').') + '">' + I.wa + esc(b.name) + '</a>';
    }).join('');
    return '<article class="plan' + (p.feature ? ' feature' : '') + '">' +
      '<div class="name"><h3>' + esc(p.name) + ' package</h3>' + (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') + '</div>' +
      '<div class="price"><small>RM</small>' + p.price + '</div>' +
      '<p class="for">' + esc(p.for) + '</p>' +
      '<div class="inc">' + esc(p.head) + '</div><ul>' + li + '</ul>' +
      '<div class="book"><span>Book on WhatsApp at</span><div class="row">' + book + '</div></div>' +
    '</article>';
  }).join('');

  document.getElementById('branchList').innerHTML = branches.map(function(b){
    var q = encodeURIComponent(b.full + ', ' + b.addr);
    return '<article class="branch">' +
      '<div class="ph"><img src="' + b.img + '" alt="Inside ' + esc(b.full) + '" loading="lazy"></div>' +
      '<div class="bd">' +
        '<div class="hd"><h3>' + esc(b.name) + '</h3><span class="chip" data-open="' + b.open + '" data-close="' + b.close + '"></span></div>' +
        '<dl><dt>Address</dt><dd>' + esc(b.addr) + '</dd>' +
        '<dt>Hours</dt><dd>' + esc(b.hours) + '</dd>' +
        '<dt>Phone</dt><dd><span class="phone"><span class="num">' + esc(b.phone) + '</span><button type="button" class="copy" id="copy-' + b.id + '" data-num="' + esc(b.phone) + '">Copy</button></span></dd></dl>' +
        (b.note ? '<div class="note">' + esc(b.note) + '</div>' : '') +
        '<div class="acts">' +
          '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="' + wa(b, 'Hi Klinik Putrijaya ' + b.name + ', I would like to make an appointment.') + '">' + I.wa + 'WhatsApp</a>' +
          '<a class="btn btn-ghost btn-sm" href="tel:+' + intl(b.phone) + '">' + I.call + 'Call</a>' +
          '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + q + '">' + I.map + 'Google Maps</a>' +
          '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://waze.com/ul?q=' + q + '&navigate=yes">' + I.waze + 'Waze</a>' +
        '</div>' +
      '</div></article>';
  }).join('');

  document.addEventListener('click', function(e){
    var btn = e.target.closest('.copy'); if(!btn) return;
    var n = btn.getAttribute('data-num');
    function done(){ btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = 'Copy'; }, 1600); }
    try {
      navigator.clipboard.writeText(n).then(done, function(){ sel(btn); });
    } catch(err){ sel(btn); }
    function sel(b){ var r=document.createRange(); r.selectNodeContents(b.previousElementSibling); var s=getSelection(); s.removeAllRanges(); s.addRange(r); }
  });

  function tick(){
    var now = myt(), h = now.getHours() + now.getMinutes()/60;
    document.querySelectorAll('.branch .chip').forEach(function(c){
      var o = +c.dataset.open, cl = +c.dataset.close, isOpen = h >= o && h < cl;
      c.className = 'chip ' + (isOpen ? 'ok' : 'off');
      c.textContent = isOpen ? 'Open now' : 'Closed · opens 8:00am';
    });
    var start = Date.UTC(2026,9,31,16,0,0), end = Date.UTC(2026,11,31,16,0,0), t = Date.now();
    var chip = document.getElementById('promoChip');
    if (t < start){ chip.className='chip soon'; chip.textContent='Starts 1 Nov'; }
    else if (t < end){ var d = Math.ceil((end - t)/86400000); chip.className='chip ok'; chip.textContent = d <= 1 ? 'Last day' : d + ' days left'; }
    else { chip.className='chip off'; chip.textContent='Promotion ended'; }
  }
  tick(); setInterval(tick, 60000);

  var dlg = document.getElementById('posterDlg');
  function openP(){ if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open',''); }
  document.getElementById('posterOpen').addEventListener('click', openP);
  document.getElementById('posterOpen2').addEventListener('click', openP);
  document.getElementById('posterClose').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
})();
