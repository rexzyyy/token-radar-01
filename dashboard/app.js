(() => {
 const data=window.RADAR;if(!data)return;
 const $=s=>document.querySelector(s),money=n=>n>=1e12?'$'+(n/1e12).toFixed(2)+'T':n>=1e9?'$'+(n/1e9).toFixed(2)+'B':n>=1e6?'$'+(n/1e6).toFixed(1)+'M':'$'+Math.round(n).toLocaleString();
 const pct=x=>x==null?'—':(x>0?'+':'')+x.toFixed(1)+'%',age=x=>x==null?'Unknown':x+'d';
 let view='board';
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 $('#as-of').textContent=data.as_of;$('#footer-date').textContent=data.as_of;$('#model-version').textContent=data.model_version;$('#model-label').textContent=data.model_version;
 $('#protocol-count').textContent='758';$('#watch-count').textContent=data.watchlist_size.toLocaleString();$('#row-count').textContent=data.board_size.toLocaleString();
 [...new Set(data.rows.map(r=>r.category).filter(Boolean))].sort().forEach(c=>$('#category').insertAdjacentHTML('beforeend','<option>'+esc(c)+'</option>'));
 [...new Set(data.rows.flatMap(r=>r.chains))].sort().forEach(c=>$('#chain').insertAdjacentHTML('beforeend','<option>'+esc(c)+'</option>'));
 const body=$('#table-body'),head=$('#table-head');
 $('#multiples').innerHTML=data.fitted_multiples.map(m=>'<tr><td>'+esc(m.category)+'</td><td class="value">'+m.multiple.toFixed(3)+'×</td><td>'+m.sample+'</td></tr>').join('');
 $('#global-multiple').textContent=data.global_multiple.toFixed(3)+'×';
 function render(){
  head.innerHTML=view==='board'?'<tr><th>Rank</th><th>Protocol</th><th>Category</th><th>Chains</th><th>TVL</th><th>7d</th><th>Age</th><th>Implied value</th></tr>':'<tr><th>Market cap rank</th><th>Protocol</th><th>Category</th><th>TVL</th><th>Market cap</th><th>7d</th></tr>';
  const q=$('#search').value.toLowerCase(),cat=$('#category').value,chain=$('#chain').value,min=Number($('#min-tvl').value),sort=$('#sort').value;
  let rows=(view==='board'?data.rows:data.live).filter(r=>(!q||(r.name+' '+r.slug).toLowerCase().includes(q))&&(!cat||r.category===cat)&&(!chain||r.chains.includes(chain))&&r.tvl_usd>=min);
  if(view==='board')rows=[...rows].sort((a,b)=>sort==='value'?b.implied_value_usd-a.implied_value_usd:sort==='tvl'?b.tvl_usd-a.tvl_usd:sort==='growth'?(b.change_7d??-Infinity)-(a.change_7d??-Infinity):sort==='age'?(b.age_days??-1)-(a.age_days??-1):a.rank-b.rank);
  else rows=[...rows].sort((a,b)=>b.mcap_usd-a.mcap_usd);
  $('#result-count').textContent='Showing '+rows.length+' of '+(view==='board'?data.board_size:data.live_size);
  body.innerHTML=rows.map((r,i)=>view==='board'?'<tr data-slug="'+esc(r.slug)+'"><td class="rank">'+String(r.rank).padStart(3,'0')+'</td><td><div class="protocol-name">'+esc(r.name)+'</div><div class="slug">'+esc(r.slug)+'</div></td><td><span class="category-pill">'+esc(r.category||'Uncategorized')+'</span></td><td class="chains">'+esc(r.chains.slice(0,3).join(' · '))+(r.chains.length>3?' +'+(r.chains.length-3):'')+'</td><td>'+money(r.tvl_usd)+'</td><td class="'+((r.change_7d??0)>=0?'positive':'negative')+'">'+pct(r.change_7d)+'</td><td>'+age(r.age_days)+'</td><td class="value">'+money(r.implied_value_usd)+'</td></tr>':'<tr><td class="rank">'+String(i+1).padStart(3,'0')+'</td><td><div class="protocol-name">'+esc(r.name)+'</div><div class="slug">'+esc(r.slug)+'</div></td><td><span class="category-pill">'+esc(r.category||'Uncategorized')+'</span></td><td>'+money(r.tvl_usd)+'</td><td class="value">'+money(r.mcap_usd)+'</td><td class="'+((r.change_7d??0)>=0?'positive':'negative')+'">'+pct(r.change_7d)+'</td></tr>').join('');
  body.querySelectorAll('tr[data-slug]').forEach(tr=>tr.addEventListener('click',()=>detail(data.rows.find(r=>r.slug===tr.dataset.slug))));
 }
 function detail(r){
  if(!r)return;const b=1+data.model.chain_weight*Math.min(Math.max(r.chains.length-1,0),data.model.chain_cap),base=data.fitted_multiples.find(x=>x.category===(r.category||'Uncategorized'))?.multiple??data.global_multiple;
  $('#detail').classList.remove('hidden');
  $('#detail').innerHTML='<div class="detail-head"><div><p class="eyebrow">RADAR RANK '+r.rank+'</p><h2>'+esc(r.name)+'</h2><div class="detail-sub">'+esc(r.slug)+' · '+esc(r.category||'Uncategorized')+' · '+esc(r.chains.join(', '))+'</div></div><button class="close" id="close-detail">Close ×</button></div><div class="fact-grid"><div class="fact"><small>Total value locked</small><b>'+money(r.tvl_usd)+'</b></div><div class="fact"><small>7 day TVL change</small><b>'+pct(r.change_7d)+'</b></div><div class="fact"><small>Tracked since</small><b>'+esc(r.listed_at||'No date recorded')+'</b></div><div class="fact"><small>Age at snapshot</small><b>'+age(r.age_days)+'</b></div><div class="fact"><small>Token record</small><b>Pre-token</b></div></div><div class="breakdown"><h3>Implied value breakdown</h3><div class="equation"><span>'+money(r.tvl_usd)+' TVL</span>×<span>'+base.toFixed(3)+'× fitted base</span>×<span>'+r.growth_multiplier.toFixed(3)+' growth</span>×<span>'+r.maturity_multiplier.toFixed(3)+' maturity</span>×<span>'+b.toFixed(3)+' breadth</span>=<b>'+money(r.implied_value_usd)+'</b></div></div><div class="farm"><h3>Farm plan · six practical steps</h3><ol>'+data.rows.find(x=>x.slug===r.slug).farm_steps.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ol><p class="notice">DefiLlama records no token for this protocol in the snapshot. This implied value is this entry’s own estimate, not a forecast or make.fun claim.</p></div>';
  $('#close-detail').onclick=()=>$('#detail').classList.add('hidden');$('#detail').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{view=btn.dataset.view;document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===btn));$('#sort').disabled=view==='live';$('#min-tvl').value='0';render();$('#detail').classList.add('hidden');}));
 ['search','category','chain','min-tvl','sort'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',render));
 render();
})();
